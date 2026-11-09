import { Injectable } from '@nestjs/common';
import { Prisma, StatusCategory } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { assigneeStats, emptyCategoryCounts } from '../tasks/assignee-stats';
import { taskInclude, toTaskView } from '../tasks/task-view';
import { DashboardQueryDto } from './dashboard-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 3;
const LIST_LIMIT = 10;
const ORDER: Record<StatusCategory, number> = { todo: 0, in_progress: 1, done: 2 };

interface WorkloadRow {
  userId: number;
  name: string;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async get(user: AuthUser, query: DashboardQueryDto) {
    if (query.projectId !== undefined) await this.access.assertCanView(user, query.projectId);

    // Phạm vi dự án được xem (+ lọc theo một dự án nếu có)
    const projectWhere: Prisma.ProjectWhereInput = {
      AND: [this.access.visibleProjectWhere(user), query.projectId !== undefined ? { id: query.projectId } : {}],
    };
    const projects = await this.prisma.project.findMany({ where: projectWhere, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const projectIds = projects.map((p) => p.id);

    const mine = user.role === 'member' || query.mine === true;
    const base: Prisma.TaskWhereInput = { projectId: { in: projectIds }, parentId: null };
    const scope: Prisma.TaskWhereInput = mine ? { ...base, assignees: { some: { userId: user.id } } } : base;
    const now = new Date();
    const soon = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);
    const notDone: Prisma.TaskWhereInput = { status: { category: { not: 'done' } } };

    const upcomingWhere: Prisma.TaskWhereInput = { ...scope, ...notDone, deadline: { gte: now, lte: soon } };
    const overdueWhere: Prisma.TaskWhereInput = { ...scope, ...notDone, deadline: { lt: now } };

    const [statusRows, upcoming, upcomingCount, overdue, overdueCount, projectRows, workloadStats] = await Promise.all([
      this.prisma.task.groupBy({ by: ['statusId'], where: scope, _count: { _all: true } }),
      this.prisma.task.findMany({ where: upcomingWhere, include: taskInclude, orderBy: [{ deadline: 'asc' }, { id: 'asc' }], take: LIST_LIMIT }),
      this.prisma.task.count({ where: upcomingWhere }),
      this.prisma.task.findMany({ where: overdueWhere, include: taskInclude, orderBy: [{ deadline: 'asc' }, { id: 'asc' }], take: LIST_LIMIT }),
      this.prisma.task.count({ where: overdueWhere }),
      this.prisma.task.groupBy({ by: ['projectId', 'statusId'], where: base, _count: { _all: true } }),
      // Task giao cho nhiều người được tính cho TỪNG người
      assigneeStats(this.prisma, { task: base }, now),
    ]);

    const statusInfo = await this.prisma.projectStatus.findMany({
      where: { id: { in: [...new Set([...statusRows, ...projectRows].map((r) => r.statusId))] } },
      select: { id: true, name: true, color: true, category: true },
    });
    const infoOf = new Map(statusInfo.map((s) => [s.id, s]));

    // Mỗi dự án có bộ trạng thái riêng: gộp theo tên để hiển thị, và theo nhóm để tính tổng
    const categoryCounts = emptyCategoryCounts();
    const breakdown = new Map<string, { name: string; color: string; category: StatusCategory; count: number }>();
    for (const row of statusRows) {
      const info = infoOf.get(row.statusId);
      if (!info) continue;
      categoryCounts[info.category] += row._count._all;
      const entry = breakdown.get(info.name) ?? { name: info.name, color: info.color, category: info.category, count: 0 };
      entry.count += row._count._all;
      breakdown.set(info.name, entry);
    }
    const totalTasks = categoryCounts.todo + categoryCounts.in_progress + categoryCounts.done;
    const statusBreakdown = [...breakdown.values()].sort((a, b) => (a.category === b.category ? b.count - a.count : ORDER[a.category] - ORDER[b.category]));

    // Tiến độ từng dự án luôn tính trên toàn bộ task cấp cao của dự án (không phụ thuộc "của tôi")
    const progress = new Map<number, { total: number; done: number }>(projectIds.map((id) => [id, { total: 0, done: 0 }]));
    for (const row of projectRows) {
      const entry = progress.get(row.projectId);
      if (!entry) continue;
      entry.total += row._count._all;
      if (infoOf.get(row.statusId)?.category === 'done') entry.done += row._count._all;
    }
    const projectProgress = projects.map((p) => {
      const { total, done } = progress.get(p.id) ?? { total: 0, done: 0 };
      return { projectId: p.id, name: p.name, total, done, progress: total === 0 ? 0 : Math.round((done / total) * 100) };
    });

    // Workload: số task theo trạng thái của từng thành viên trong phạm vi dự án
    const workloadMap = new Map<number, WorkloadRow>();
    const rowFor = (userId: number): WorkloadRow => {
      let row = workloadMap.get(userId);
      if (!row) {
        row = { userId, name: '', todo: 0, in_progress: 0, done: 0, overdue: 0 };
        workloadMap.set(userId, row);
      }
      return row;
    };
    for (const [userId, stat] of workloadStats) {
      Object.assign(rowFor(userId), stat.counts, { overdue: stat.overdue });
    }
    const names = await this.prisma.user.findMany({ where: { id: { in: [...workloadMap.keys()] } }, select: { id: true, name: true } });
    for (const u of names) {
      const row = workloadMap.get(u.id);
      if (row) row.name = u.name;
    }
    const workload = [...workloadMap.values()].sort(
      (a, b) => b.todo + b.in_progress - (a.todo + a.in_progress) || a.name.localeCompare(b.name),
    );

    return {
      scope: mine ? ('mine' as const) : ('team' as const),
      categoryCounts,
      statusBreakdown,
      totalTasks,
      upcoming: upcoming.map(toTaskView),
      upcomingCount,
      overdue: overdue.map(toTaskView),
      overdueCount,
      projectProgress,
      workload,
    };
  }
}
