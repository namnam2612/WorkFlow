import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { startOfVnDay } from '../tasks/my-work';
import { CreateWorkLogDto } from './dto/worklog.dto';

const DAY = 24 * 60 * 60 * 1000;
/** Thành viên thường chỉ ghi bù tối đa chừng này ngày về trước; leader/admin không giới hạn */
const BACKDATE_LIMIT_DAYS = 60;
const MAX_TIMESHEET_DAYS = 92;

type Db = PrismaService | Prisma.TransactionClient;

/** "YYYY-MM-DD" (giờ VN) -> 00:00 VN dạng UTC; null nếu không phải ngày hợp lệ */
export function parseVnDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  // Chặn ngày "tràn" (vd 30/02 bị JS đổi thành 02/03): đổi ngược về giờ VN phải ra đúng chuỗi ban đầu
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) === value ? date : null;
}

@Injectable()
export class WorkLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
  ) {}

  async list(user: AuthUser, taskId: number) {
    const task = await this.findTask(taskId);
    await this.access.assertCanView(user, task.projectId);
    const logs = await this.prisma.workLog.findMany({
      where: { taskId },
      include: { user: { select: USER_BRIEF_SELECT } },
      orderBy: [{ workedOn: 'desc' }, { id: 'desc' }],
    });
    return { items: logs, totalMinutes: logs.reduce((sum, l) => sum + l.minutes, 0) };
  }

  /** Người được giao (hoặc leader/admin của dự án) ghi nhận thời gian; `actualHours` của task được cập nhật theo tổng */
  async add(user: AuthUser, taskId: number, dto: CreateWorkLogDto, now: Date = new Date()) {
    const task = await this.findTask(taskId);
    const project = await this.access.assertCanView(user, task.projectId);
    const canManage = this.access.canManage(user, project);
    if (task.type === 'epic') throw new BadRequestException('Epic chỉ là nhóm story, không ghi nhận thời gian vào Epic');
    if (!canManage && !task.assignees.some((a) => a.userId === user.id)) {
      throw new ForbiddenException('Bạn chỉ được ghi nhận thời gian cho công việc được giao cho mình');
    }

    const today = startOfVnDay(now);
    const workedOn = dto.workedOn ? parseVnDate(dto.workedOn) : today;
    if (!workedOn) throw new BadRequestException('Ngày làm việc không hợp lệ');
    if (workedOn.getTime() > today.getTime()) throw new BadRequestException('Không ghi nhận thời gian cho ngày trong tương lai');
    if (!canManage && workedOn.getTime() < today.getTime() - BACKDATE_LIMIT_DAYS * DAY) {
      throw new BadRequestException(`Chỉ được ghi bù tối đa ${BACKDATE_LIMIT_DAYS} ngày`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const log = await tx.workLog.create({
        data: { taskId, userId: user.id, minutes: dto.minutes, workedOn, note: dto.note ?? null },
        include: { user: { select: USER_BRIEF_SELECT } },
      });
      await this.syncActualHours(tx, taskId);
      await this.activity.log(
        { taskId, userId: user.id, action: 'worklog_added', detail: { minutes: dto.minutes, workedOn: workedOn.toISOString(), note: dto.note ?? null } },
        tx,
      );
      return log;
    });
    return created;
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const log = await this.prisma.workLog.findUnique({ where: { id }, include: { task: { select: { projectId: true } } } });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi thời gian');
    const project = await this.access.assertCanView(user, log.task.projectId);
    if (log.userId !== user.id && !this.access.canManage(user, project)) {
      throw new ForbiddenException('Chỉ người ghi hoặc trưởng nhóm/quản trị viên mới được xóa');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.workLog.delete({ where: { id } });
      await this.syncActualHours(tx, log.taskId);
      await this.activity.log({ taskId: log.taskId, userId: user.id, action: 'worklog_removed', detail: { minutes: log.minutes, workedOn: log.workedOn.toISOString() } }, tx);
    });
  }

  /**
   * Bảng chấm công của dự án trong khoảng [from, to] (mặc định 14 ngày gần nhất): tổng phút theo người và theo ngày.
   * Chỉ thành viên xem được; thành viên thường chỉ thấy phần của mình.
   */
  async timesheet(user: AuthUser, projectId: number, from?: string, to?: string, now: Date = new Date()) {
    const project = await this.access.assertCanView(user, projectId);
    const canManage = this.access.canManage(user, project);
    const end = to ? parseVnDate(to) : startOfVnDay(now);
    const start = from ? parseVnDate(from) : end ? new Date(end.getTime() - 13 * DAY) : null;
    if (!start || !end) throw new BadRequestException('Khoảng ngày không hợp lệ');
    if (end.getTime() < start.getTime()) throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if ((end.getTime() - start.getTime()) / DAY > MAX_TIMESHEET_DAYS) throw new BadRequestException(`Chỉ xem tối đa ${MAX_TIMESHEET_DAYS} ngày một lần`);

    const logs = await this.prisma.workLog.findMany({
      where: { task: { projectId }, workedOn: { gte: start, lte: end }, ...(canManage ? {} : { userId: user.id }) },
      select: { minutes: true, workedOn: true, taskId: true, user: { select: USER_BRIEF_SELECT } },
    });

    const byUser = new Map<number, { user: { id: number; name: string; avatarUrl: string | null }; minutes: number; tasks: Set<number> }>();
    const byDay = new Map<string, number>();
    for (const log of logs) {
      const entry = byUser.get(log.user.id) ?? { user: log.user, minutes: 0, tasks: new Set<number>() };
      entry.minutes += log.minutes;
      entry.tasks.add(log.taskId);
      byUser.set(log.user.id, entry);
      const day = log.workedOn.toISOString();
      byDay.set(day, (byDay.get(day) ?? 0) + log.minutes);
    }
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      totalMinutes: logs.reduce((sum, l) => sum + l.minutes, 0),
      byUser: [...byUser.values()].map((e) => ({ user: e.user, minutes: e.minutes, taskCount: e.tasks.size })).sort((a, b) => b.minutes - a.minutes),
      byDay: [...byDay.entries()].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  // ---------------------------------------------------------------- helpers

  /** Khi đã có ghi nhận thời gian, giờ thực tế của task = tổng thời gian đã ghi (làm tròn 2 chữ số) */
  private async syncActualHours(db: Db, taskId: number): Promise<void> {
    const sum = await db.workLog.aggregate({ where: { taskId }, _sum: { minutes: true } });
    const minutes = sum._sum.minutes ?? 0;
    await db.task.update({ where: { id: taskId }, data: { actualHours: minutes === 0 ? null : Math.round((minutes / 60) * 100) / 100 } });
  }

  private async findTask(taskId: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true, projectId: true, type: true, assignees: { select: { userId: true } } } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }
}
