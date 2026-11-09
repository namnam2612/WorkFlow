import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { assigneeStats } from '../tasks/assignee-stats';
import { taskInclude, toTaskView } from '../tasks/task-view';
import { DashboardQueryDto } from './dashboard-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 3;
const LIST_LIMIT = 10;

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];

interface WorkloadRow {
  userId: number;
  name: string;
  todo: number;
  in_progress: number;
  review: number;
  blocked: number;
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
    const notDone: Prisma.TaskWhereInput = { status: { not: 'done' } };

    const upcomingWhere: Prisma.TaskWhereInput = { ...scope, ...notDone, deadline: { gte: now, lte: soon } };
    const overdueWhere: Prisma.TaskWhereInput = { ...scope, ...notDone, deadline: { lt: now } };

    const [statusRows, upcoming, upcomingCount, overdue, overdueCount, projectRows, workloadStats] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      this.prisma.task.findMany({ where: upcomingWhere, include: taskInclude, orderBy: [{ deadline: 'asc' }, { id: 'asc' }], take: LIST_LIMIT }),
      this.prisma.task.count({ where: upcomingWhere }),
      this.prisma.task.findMany({ where: overdueWhere, include: taskInclude, orderBy: [{ deadline: 'asc' }, { id: 'asc' }], take: LIST_LIMIT }),
      this.prisma.task.count({ where: overdueWhere }),
      this.prisma.task.groupBy({ by: ['projectId', 'status'], where: base, _count: { _all: true } }),
      // Task giao cho nhiều người được tính cho TỪNG người
      assigneeStats(this.prisma, { task: base }, now),
    ]);

    const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    for (const row of statusRows) statusCounts[row.status] = row._count._all;
    const totalTasks = STATUSES.reduce((sum, s) => sum + statusCounts[s], 0);

    // Tiến độ từng dự án luôn tính trên toàn bộ task cấp cao của dự án (không phụ thuộc "của tôi")
    const progress = new Map<number, { total: number; done: number }>(projectIds.map((id) => [id, { total: 0, done: 0 }]));
    for (const row of projectRows) {
      const entry = progress.get(row.projectId);
      if (!entry) continue;
      entry.total += row._count._all;
      if (row.status === 'done') entry.done += row._count._all;
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
        row = { userId, name: '', todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0, overdue: 0 };
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
      (a, b) => b.todo + b.in_progress + b.review + b.blocked - (a.todo + a.in_progress + a.review + a.blocked) || a.name.localeCompare(b.name),
    );

    return {
      scope: mine ? ('mine' as const) : ('team' as const),
      statusCounts,
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
