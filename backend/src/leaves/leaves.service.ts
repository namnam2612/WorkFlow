import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Leave, Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { startOfVnDay } from '../tasks/my-work';
import { parseVnDate } from '../worklogs/worklogs.service';
import { CreateLeaveDto, ListLeavesQueryDto, ReviewLeaveDto } from './dto/leave.dto';
import { HOURS_PER_DAY, leaveWorkingDaysIn, rangesOverlap, workingDays } from './leave-days';

const DAY = 24 * 60 * 60 * 1000;
const MAX_LEAVE_DAYS = 60;
const BACKDATE_DAYS = 90;
const MAX_RANGE_DAYS = 120;

const leaveInclude = {
  user: { select: USER_BRIEF_SELECT },
  reviewer: { select: USER_BRIEF_SELECT },
} satisfies Prisma.LeaveInclude;
type LeaveRow = Prisma.LeaveGetPayload<{ include: typeof leaveInclude }>;

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----------------------------------------------------------- phạm vi quyền

  /**
   * Những người mà `user` có quyền duyệt nghỉ: admin = mọi người; leader = thành viên của nhóm mình dẫn dắt
   * và của dự án mình tạo; member = không ai. Trả null nghĩa là "tất cả".
   */
  async reviewableUserIds(user: AuthUser): Promise<number[] | null> {
    if (user.role === 'admin') return null;
    if (user.role !== 'leader') return [];
    const [teamMembers, projectMembers] = await Promise.all([
      this.prisma.teamMember.findMany({ where: { team: { leaderId: user.id } }, select: { userId: true } }),
      this.prisma.projectMember.findMany({ where: { project: { createdById: user.id } }, select: { userId: true } }),
    ]);
    return [...new Set([...teamMembers, ...projectMembers].map((m) => m.userId))].filter((id) => id !== user.id);
  }

  /** Đồng đội: cùng dự án hoặc cùng nhóm (xem được lịch nghỉ ĐÃ DUYỆT của nhau để biết ai vắng) */
  private async colleagueIds(user: AuthUser): Promise<number[]> {
    const [viaProjects, viaTeams] = await Promise.all([
      this.prisma.projectMember.findMany({ where: { project: { members: { some: { userId: user.id } } } }, select: { userId: true } }),
      this.prisma.teamMember.findMany({ where: { team: { members: { some: { userId: user.id } } } }, select: { userId: true } }),
    ]);
    return [...new Set([...viaProjects, ...viaTeams].map((m) => m.userId))];
  }

  async canReview(user: AuthUser, leaveUserId: number): Promise<boolean> {
    if (leaveUserId === user.id) return false;
    const ids = await this.reviewableUserIds(user);
    return ids === null || ids.includes(leaveUserId);
  }

  // ---------------------------------------------------------------- queries

  /**
   * Danh sách đơn nghỉ trong phạm vi nhìn thấy: của mình (mọi trạng thái), của người mình duyệt (mọi trạng thái),
   * và của đồng đội (chỉ đơn đã duyệt, ẩn lý do).
   */
  async list(user: AuthUser, query: ListLeavesQueryDto) {
    const reviewable = await this.reviewableUserIds(user);
    const colleagues = user.role === 'admin' ? [] : await this.colleagueIds(user);
    const scope: Prisma.LeaveWhereInput =
      reviewable === null
        ? {}
        : { OR: [{ userId: user.id }, { userId: { in: reviewable } }, { userId: { in: colleagues }, status: 'approved' }] };

    const filters: Prisma.LeaveWhereInput[] = [scope];
    if (query.status) filters.push({ status: query.status });
    if (query.userId !== undefined) filters.push({ userId: query.userId });
    const from = query.from ? parseVnDate(query.from) : null;
    const to = query.to ? parseVnDate(query.to) : null;
    if (from) filters.push({ endDate: { gte: from } });
    if (to) filters.push({ startDate: { lte: to } });

    const leaves = await this.prisma.leave.findMany({ where: { AND: filters }, include: leaveInclude, orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: 500 });
    const reviewableSet = reviewable === null ? null : new Set(reviewable);
    return leaves.map((l) => this.toView(user, l, reviewableSet === null || reviewableSet.has(l.userId)));
  }

  /**
   * Capacity của các thành viên dự án trong khoảng ngày: ngày làm việc (T2–T6) trừ ngày nghỉ đã duyệt, quy ra giờ.
   * Chỉ thành viên của dự án mới xem được.
   */
  async capacityForProject(user: AuthUser, projectId: number, fromStr?: string, toStr?: string, now: Date = new Date()) {
    await this.access.assertCanView(user, projectId);
    const today = startOfVnDay(now);
    const from = fromStr ? parseVnDate(fromStr) : today;
    const to = toStr ? parseVnDate(toStr) : from ? new Date(from.getTime() + 13 * DAY) : null;
    if (!from || !to) throw new BadRequestException('Khoảng ngày không hợp lệ');
    return this.capacity(projectId, from, to);
  }

  async capacity(projectId: number, from: Date, to: Date) {
    if (to.getTime() < from.getTime()) throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if ((to.getTime() - from.getTime()) / DAY > MAX_RANGE_DAYS) throw new BadRequestException(`Chỉ tính tối đa ${MAX_RANGE_DAYS} ngày`);
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { createdById: true, members: { select: { user: { select: { ...USER_BRIEF_SELECT, isActive: true, role: true } } } } },
    });
    const people = project.members.map((m) => m.user).filter((u) => u.isActive && u.role !== 'admin');
    const leaves = await this.prisma.leave.findMany({
      where: { userId: { in: people.map((p) => p.id) }, status: 'approved', startDate: { lte: to }, endDate: { gte: from } },
      select: { userId: true, startDate: true, endDate: true },
    });
    const total = workingDays(from, to).length;
    const rows = people.map((person) => {
      const leaveDays = leaves.filter((l) => l.userId === person.id).reduce((sum, l) => sum + leaveWorkingDaysIn(l.startDate, l.endDate, from, to), 0);
      const available = Math.max(0, total - leaveDays);
      return { user: { id: person.id, name: person.name, avatarUrl: person.avatarUrl }, workingDays: total, leaveDays, availableDays: available, availableHours: available * HOURS_PER_DAY };
    });
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      hoursPerDay: HOURS_PER_DAY,
      totalAvailableDays: rows.reduce((s, r) => s + r.availableDays, 0),
      totalAvailableHours: rows.reduce((s, r) => s + r.availableHours, 0),
      totalLeaveDays: rows.reduce((s, r) => s + r.leaveDays, 0),
      members: rows.sort((a, b) => a.availableDays - b.availableDays || a.user.name.localeCompare(b.user.name)),
    };
  }

  // -------------------------------------------------------------- mutations

  /** Gửi đơn nghỉ. Leader/admin tự duyệt đơn của chính mình; thành viên chờ người duyệt. */
  async create(user: AuthUser, dto: CreateLeaveDto, now: Date = new Date()) {
    const start = parseVnDate(dto.startDate);
    const end = parseVnDate(dto.endDate);
    if (!start || !end) throw new BadRequestException('Ngày không hợp lệ');
    if (end.getTime() < start.getTime()) throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if ((end.getTime() - start.getTime()) / DAY + 1 > MAX_LEAVE_DAYS) throw new BadRequestException(`Mỗi đơn nghỉ tối đa ${MAX_LEAVE_DAYS} ngày`);
    if (start.getTime() < startOfVnDay(now).getTime() - BACKDATE_DAYS * DAY) throw new BadRequestException(`Chỉ được xin nghỉ bù trong ${BACKDATE_DAYS} ngày gần đây`);
    if (workingDays(start, end).length === 0) throw new BadRequestException('Khoảng ngày chỉ gồm thứ bảy/chủ nhật, không cần xin nghỉ');
    await this.assertNoOverlap(user.id, start, end);

    const selfApprove = user.role === 'admin' || user.role === 'leader';
    const leave = await this.prisma.leave.create({
      data: {
        userId: user.id,
        startDate: start,
        endDate: end,
        type: dto.type ?? 'annual',
        reason: dto.reason ?? null,
        status: selfApprove ? 'approved' : 'pending',
        reviewedById: selfApprove ? user.id : null,
        reviewedAt: selfApprove ? now : null,
      },
      include: leaveInclude,
    });
    if (!selfApprove) await this.notifyReviewers(user, leave);
    return this.toView(user, leave, false);
  }

  /** Hủy đơn của chính mình (đang chờ hoặc đã duyệt nhưng chưa kết thúc) */
  async cancel(user: AuthUser, id: number, now: Date = new Date()) {
    const leave = await this.findOrThrow(id);
    if (leave.userId !== user.id) throw new ForbiddenException('Bạn chỉ được hủy đơn nghỉ của chính mình');
    if (leave.status !== 'pending' && leave.status !== 'approved') throw new BadRequestException('Đơn này không thể hủy');
    if (leave.endDate.getTime() < startOfVnDay(now).getTime()) throw new BadRequestException('Đơn nghỉ đã kết thúc, không thể hủy');
    const updated = await this.prisma.leave.update({ where: { id }, data: { status: 'cancelled' }, include: leaveInclude });
    return this.toView(user, updated, false);
  }

  /** Duyệt hoặc từ chối đơn đang chờ: admin, hoặc leader của nhóm/dự án có người đó. Không tự duyệt đơn của mình. */
  async review(user: AuthUser, id: number, dto: ReviewLeaveDto, now: Date = new Date()) {
    const leave = await this.findOrThrow(id);
    if (leave.userId === user.id) throw new ForbiddenException('Bạn không thể tự duyệt đơn của mình');
    if (!(await this.canReview(user, leave.userId))) throw new ForbiddenException('Bạn không có quyền duyệt đơn nghỉ của người này');
    if (leave.status !== 'pending') throw new BadRequestException('Đơn này không còn ở trạng thái chờ duyệt');
    const updated = await this.prisma.leave.update({
      where: { id },
      data: { status: dto.approve ? 'approved' : 'rejected', reviewedById: user.id, reviewedAt: now, reviewNote: dto.note ?? null },
      include: leaveInclude,
    });
    await this.notifications.notify([
      {
        userId: leave.userId,
        type: 'leave_reviewed',
        message: `${user.name} đã ${dto.approve ? 'duyệt' : 'từ chối'} đơn nghỉ ${this.rangeLabel(leave)} của bạn`,
        link: '/leave',
      },
    ]);
    return this.toView(user, updated, true);
  }

  // ---------------------------------------------------------------- helpers

  private async findOrThrow(id: number): Promise<LeaveRow> {
    const leave = await this.prisma.leave.findUnique({ where: { id }, include: leaveInclude });
    if (!leave) throw new NotFoundException('Không tìm thấy đơn nghỉ');
    return leave;
  }

  private async assertNoOverlap(userId: number, start: Date, end: Date): Promise<void> {
    const existing = await this.prisma.leave.findMany({ where: { userId, status: { in: ['pending', 'approved'] }, startDate: { lte: end }, endDate: { gte: start } }, select: { startDate: true, endDate: true } });
    if (existing.some((l) => rangesOverlap(l.startDate, l.endDate, start, end))) throw new BadRequestException('Đã có đơn nghỉ trùng với khoảng ngày này');
  }

  private async notifyReviewers(requester: AuthUser, leave: Leave): Promise<void> {
    const [teamLeaders, projectCreators] = await Promise.all([
      this.prisma.team.findMany({ where: { members: { some: { userId: requester.id } } }, select: { leaderId: true } }),
      this.prisma.project.findMany({ where: { members: { some: { userId: requester.id } } }, select: { createdById: true } }),
    ]);
    const reviewers = new Set([...teamLeaders.map((t) => t.leaderId), ...projectCreators.map((p) => p.createdById)]);
    reviewers.delete(requester.id);
    await this.notifications.notify(
      [...reviewers].map((userId) => ({ userId, type: 'leave_requested', message: `${requester.name} xin nghỉ ${this.rangeLabel(leave)}`, link: '/leave' })),
    );
  }

  private rangeLabel(leave: Pick<Leave, 'startDate' | 'endDate'>): string {
    const fmt = (d: Date) => new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(8, 10) + '/' + new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(5, 7);
    return leave.startDate.getTime() === leave.endDate.getTime() ? fmt(leave.startDate) : `${fmt(leave.startDate)}–${fmt(leave.endDate)}`;
  }

  /** Đồng đội chỉ thấy khoảng ngày và loại nghỉ, không thấy lý do/ghi chú duyệt */
  private toView(viewer: AuthUser, leave: LeaveRow, reviewer: boolean) {
    const own = leave.userId === viewer.id;
    const full = own || reviewer || viewer.role === 'admin';
    return {
      id: leave.id,
      user: leave.user,
      startDate: leave.startDate,
      endDate: leave.endDate,
      type: leave.type,
      status: leave.status,
      createdAt: leave.createdAt,
      reason: full ? leave.reason : null,
      reviewNote: full ? leave.reviewNote : null,
      reviewer: full ? leave.reviewer : null,
      reviewedAt: full ? leave.reviewedAt : null,
      /** Người xem được phép duyệt đơn này ngay bây giờ */
      canReview: reviewer && leave.status === 'pending' && !own,
      canCancel: own && (leave.status === 'pending' || leave.status === 'approved'),
    };
  }
}
