import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { LeavesService } from '../leaves/leaves.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { taskInclude, toTaskView } from '../tasks/task-view';
import { parseVnDate } from '../worklogs/worklogs.service';

const DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 70;
const TASK_LIMIT = 600;

/** Dữ liệu cho trang Lịch (tháng) và biểu đồ Gantt */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly leaves: LeavesService,
  ) {}

  /**
   * Lịch làm việc trong [from, to]: công việc có ngày bắt đầu/deadline rơi vào khoảng, sprint giao với khoảng,
   * và các ngày nghỉ đã duyệt của những người mình được phép thấy — chỉ trong các dự án mình tham gia.
   */
  async calendar(user: AuthUser, query: { from: string; to: string; projectId?: number; mine?: boolean }) {
    const from = parseVnDate(query.from);
    const toStart = parseVnDate(query.to);
    if (!from || !toStart) throw new BadRequestException('Khoảng ngày không hợp lệ');
    const to = new Date(toStart.getTime() + DAY - 1); // hết ngày `to`
    if (to.getTime() < from.getTime()) throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if ((to.getTime() - from.getTime()) / DAY > MAX_RANGE_DAYS) throw new BadRequestException(`Chỉ xem tối đa ${MAX_RANGE_DAYS} ngày một lần`);
    if (query.projectId !== undefined) await this.access.assertCanView(user, query.projectId);

    const project: Prisma.ProjectWhereInput = { AND: [this.access.visibleProjectWhere(user), query.projectId !== undefined ? { id: query.projectId } : {}] };
    const taskWhere: Prisma.TaskWhereInput = {
      project,
      type: { not: 'epic' },
      ...(query.mine ? { assignees: { some: { userId: user.id } } } : {}),
      OR: [{ deadline: { gte: from, lte: to } }, { startDate: { gte: from, lte: to } }, { startDate: { lte: to }, deadline: { gte: from } }],
    };
    const [tasks, sprints, leaves] = await Promise.all([
      this.prisma.task.findMany({ where: taskWhere, include: taskInclude, orderBy: [{ deadline: 'asc' }, { id: 'asc' }], take: TASK_LIMIT }),
      this.prisma.sprint.findMany({
        where: { project, status: { in: ['planned', 'active', 'completed'] }, startDate: { lte: to }, endDate: { gte: from } },
        select: { id: true, name: true, status: true, startDate: true, endDate: true, projectId: true },
        orderBy: { startDate: 'asc' },
      }),
      this.leaves.list(user, { from: query.from, to: query.to, status: 'approved' }),
    ]);
    return { from: from.toISOString(), to: to.toISOString(), tasks: tasks.map(toTaskView), sprints, leaves };
  }

  /** Gantt của một dự án: việc cấp cao (kèm Epic để gom nhóm), các phụ thuộc và sprint */
  async gantt(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    const [tasks, dependencies, sprints] = await Promise.all([
      this.prisma.task.findMany({ where: { projectId, parentId: null }, include: taskInclude, orderBy: [{ startDate: 'asc' }, { deadline: 'asc' }, { id: 'asc' }], take: TASK_LIMIT }),
      this.prisma.taskDependency.findMany({ where: { task: { projectId } }, select: { taskId: true, dependsOnId: true } }),
      this.prisma.sprint.findMany({ where: { projectId }, select: { id: true, name: true, status: true, startDate: true, endDate: true }, orderBy: { startDate: 'asc' } }),
    ]);
    return { tasks: tasks.map(toTaskView), dependencies, sprints };
  }
}
