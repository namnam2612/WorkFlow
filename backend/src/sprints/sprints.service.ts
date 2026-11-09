import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Sprint } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { taskInclude, toTaskView } from '../tasks/task-view';
import { LeavesService } from '../leaves/leaves.service';
import { Burndown, buildBurndown } from './burndown';
import { CompleteSprintDto, CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SPRINT_DAYS = 14;
const BACKLOG_LIMIT = 500;

/** Việc tính vào sprint/backlog: cấp cao và không phải Epic (Epic chỉ là nhóm story) */
const PLANNABLE: Prisma.TaskWhereInput = { parentId: null, type: { not: 'epic' } };

export interface SprintStats {
  taskCount: number;
  doneCount: number;
  points: number;
  donePoints: number;
}

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly leaves: LeavesService,
  ) {}

  // ---------------------------------------------------------------- queries

  /** Mọi sprint của dự án kèm thống kê (số việc, điểm, điểm đã xong), mới nhất trước */
  async list(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    const sprints = await this.prisma.sprint.findMany({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const stats = await this.statsFor(sprints.map((s) => s.id));
    return sprints.map((s) => ({ ...s, stats: stats.get(s.id) ?? emptyStats() }));
  }

  /**
   * Trang Backlog: các sprint chưa kết thúc kèm việc của từng sprint, backlog (việc chưa thuộc sprint nào),
   * và danh sách epic kèm tiến độ các story con.
   */
  async backlog(user: AuthUser, projectId: number, includeDone: boolean) {
    await this.access.assertCanView(user, projectId);
    const [sprints, backlogTasks, epics] = await Promise.all([
      this.prisma.sprint.findMany({ where: { projectId, status: { in: ['planned', 'active'] } }, orderBy: [{ status: 'asc' }, { startDate: 'asc' }, { id: 'asc' }] }),
      this.prisma.task.findMany({
        where: { projectId, ...PLANNABLE, sprintId: null, ...(includeDone ? {} : { status: { category: { not: 'done' } } }) },
        include: taskInclude,
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        take: BACKLOG_LIMIT,
      }),
      this.prisma.task.findMany({ where: { projectId, type: 'epic' }, include: taskInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    ]);
    const sprintTasks = await this.prisma.task.findMany({
      where: { projectId, ...PLANNABLE, sprintId: { in: sprints.map((s) => s.id) } },
      include: taskInclude,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    const children = await this.prisma.task.findMany({
      where: { projectId, epicId: { in: epics.map((e) => e.id) } },
      select: { epicId: true, storyPoints: true, status: { select: { category: true } } },
    });
    const epicStats = new Map<number, SprintStats>();
    for (const c of children) {
      if (c.epicId === null) continue;
      const stat = epicStats.get(c.epicId) ?? emptyStats();
      stat.taskCount += 1;
      stat.points += c.storyPoints ?? 0;
      if (c.status.category === 'done') {
        stat.doneCount += 1;
        stat.donePoints += c.storyPoints ?? 0;
      }
      epicStats.set(c.epicId, stat);
    }

    const stats = await this.statsFor(sprints.map((s) => s.id));
    return {
      sprints: sprints.map((s) => ({ ...s, stats: stats.get(s.id) ?? emptyStats(), tasks: sprintTasks.filter((t) => t.sprintId === s.id).map(toTaskView) })),
      backlog: backlogTasks.map(toTaskView),
      epics: epics.map((e) => ({ ...toTaskView(e), stats: epicStats.get(e.id) ?? emptyStats() })),
    };
  }

  async burndown(user: AuthUser, sprintId: number, now: Date = new Date()): Promise<{ sprint: Sprint } & Burndown> {
    const sprint = await this.findOrThrow(sprintId);
    await this.access.assertCanView(user, sprint.projectId);
    const tasks = await this.prisma.task.findMany({
      where: { sprintId, ...PLANNABLE },
      select: { storyPoints: true, completedAt: true },
    });
    const startDate = sprint.startDate ?? sprint.startedAt ?? sprint.createdAt;
    const endDate = sprint.endDate ?? new Date(startDate.getTime() + DEFAULT_SPRINT_DAYS * DAY);
    const result = buildBurndown({ startDate, endDate, committedPoints: sprint.committedPoints, tasks: tasks.map((t) => ({ points: t.storyPoints, completedAt: t.completedAt })), now });
    return { sprint, ...result };
  }

  /**
   * Capacity thực tế của sprint: ngày làm việc của từng thành viên dự án trừ nghỉ phép đã duyệt, quy ra giờ,
   * kèm tổng điểm cam kết/phạm vi để so sánh với sức chứa.
   */
  async capacity(user: AuthUser, sprintId: number) {
    const sprint = await this.findOrThrow(sprintId);
    await this.access.assertCanView(user, sprint.projectId);
    const start = sprint.startDate ?? sprint.startedAt ?? sprint.createdAt;
    const end = sprint.endDate ?? new Date(start.getTime() + (DEFAULT_SPRINT_DAYS - 1) * DAY);
    const [capacity, scope] = await Promise.all([
      this.leaves.capacity(sprint.projectId, start, end),
      this.prisma.task.aggregate({ where: { sprintId, ...PLANNABLE }, _sum: { storyPoints: true } }),
    ]);
    return { sprintId, ...capacity, plannedPoints: scope._sum.storyPoints ?? 0, committedPoints: sprint.committedPoints };
  }

  /** Velocity: điểm cam kết và điểm hoàn thành của các sprint đã kết thúc gần nhất (cũ → mới) + trung bình 3 sprint gần nhất */
  async velocity(user: AuthUser, projectId: number, limit: number) {
    await this.access.assertCanView(user, projectId);
    const sprints = await this.prisma.sprint.findMany({ where: { projectId, status: 'completed' }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], take: limit });
    const items = sprints.reverse().map((s) => ({ id: s.id, name: s.name, committed: s.committedPoints ?? 0, completed: s.completedPoints ?? 0, completedAt: s.completedAt }));
    const recent = items.slice(-3);
    const average = recent.length === 0 ? 0 : Math.round((recent.reduce((sum, s) => sum + s.completed, 0) / recent.length) * 10) / 10;
    return { items, average };
  }

  // -------------------------------------------------------------- mutations

  async create(user: AuthUser, projectId: number, dto: CreateSprintDto): Promise<Sprint> {
    await this.access.assertCanManage(user, projectId);
    this.assertRange(dto.startDate, dto.endDate);
    return this.prisma.sprint.create({
      data: {
        projectId,
        name: dto.name,
        goal: dto.goal ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateSprintDto): Promise<Sprint> {
    const sprint = await this.findOrThrow(id);
    await this.access.assertCanManage(user, sprint.projectId);
    if (sprint.status === 'completed') throw new BadRequestException('Sprint đã kết thúc, không thể sửa');
    const startDate = dto.startDate === undefined ? sprint.startDate?.toISOString() : dto.startDate;
    const endDate = dto.endDate === undefined ? sprint.endDate?.toISOString() : dto.endDate;
    this.assertRange(startDate, endDate);
    return this.prisma.sprint.update({
      where: { id },
      data: {
        name: dto.name,
        goal: dto.goal,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  /** Chỉ xóa được sprint chưa bắt đầu; việc trong sprint quay về backlog (khóa ngoại SetNull) */
  async remove(user: AuthUser, id: number): Promise<void> {
    const sprint = await this.findOrThrow(id);
    await this.access.assertCanManage(user, sprint.projectId);
    if (sprint.status !== 'planned') throw new BadRequestException('Chỉ xóa được sprint chưa bắt đầu');
    await this.prisma.sprint.delete({ where: { id } });
  }

  async start(user: AuthUser, id: number, now: Date = new Date()): Promise<Sprint> {
    const sprint = await this.findOrThrow(id);
    await this.access.assertCanManage(user, sprint.projectId);
    if (sprint.status !== 'planned') throw new BadRequestException('Chỉ bắt đầu được sprint đang ở trạng thái "Kế hoạch"');
    const active = await this.prisma.sprint.findFirst({ where: { projectId: sprint.projectId, status: 'active' }, select: { name: true } });
    if (active) throw new BadRequestException(`Dự án đang có sprint "${active.name}" đang chạy, hãy kết thúc nó trước`);

    const startDate = sprint.startDate ?? now;
    const endDate = sprint.endDate ?? new Date(startDate.getTime() + DEFAULT_SPRINT_DAYS * DAY);
    this.assertRange(startDate.toISOString(), endDate.toISOString());
    const committed = await this.prisma.task.aggregate({ where: { sprintId: id, ...PLANNABLE }, _sum: { storyPoints: true } });
    return this.prisma.sprint.update({
      where: { id },
      data: { status: 'active', startDate, endDate, startedAt: now, committedPoints: committed._sum.storyPoints ?? 0 },
    });
  }

  /**
   * Kết thúc sprint: ghi điểm đã xong (velocity) và xử lý việc chưa xong, chuyển về backlog (mặc định)
   * hoặc sang một sprint khác chưa kết thúc của cùng dự án.
   */
  async complete(user: AuthUser, id: number, dto: CompleteSprintDto, now: Date = new Date()): Promise<Sprint> {
    const sprint = await this.findOrThrow(id);
    await this.access.assertCanManage(user, sprint.projectId);
    if (sprint.status !== 'active') throw new BadRequestException('Chỉ kết thúc được sprint đang chạy');

    const targetId = dto.moveIncompleteTo ?? null;
    if (targetId !== null) {
      const target = await this.prisma.sprint.findUnique({ where: { id: targetId }, select: { projectId: true, status: true } });
      if (!target || target.projectId !== sprint.projectId || target.status === 'completed' || targetId === id) {
        throw new BadRequestException('Sprint đích không hợp lệ (phải là sprint chưa kết thúc khác của dự án)');
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const done = await tx.task.aggregate({ where: { sprintId: id, ...PLANNABLE, status: { category: 'done' } }, _sum: { storyPoints: true } });
      const incomplete = await tx.task.findMany({ where: { sprintId: id, ...PLANNABLE, status: { category: { not: 'done' } } }, select: { id: true } });
      if (incomplete.length > 0) await tx.task.updateMany({ where: { id: { in: incomplete.map((t) => t.id) } }, data: { sprintId: targetId } });
      return tx.sprint.update({ where: { id }, data: { status: 'completed', completedAt: now, completedPoints: done._sum.storyPoints ?? 0 } });
    });
  }

  /** Đưa nhiều việc vào sprint (hoặc về backlog khi `sprintId` = null) — dùng cho kéo thả/chọn nhiều ở trang Backlog */
  async moveTasks(user: AuthUser, projectId: number, sprintId: number | null, taskIds: number[]): Promise<{ moved: number }> {
    await this.access.assertCanManage(user, projectId);
    if (sprintId !== null) {
      const sprint = await this.findOrThrow(sprintId);
      if (sprint.projectId !== projectId) throw new NotFoundException('Không tìm thấy sprint');
      if (sprint.status === 'completed') throw new BadRequestException('Sprint đã kết thúc, không thể thêm công việc vào');
    }
    const tasks = await this.prisma.task.findMany({ where: { id: { in: taskIds }, projectId, ...PLANNABLE }, select: { id: true, sprintId: true } });
    if (tasks.length !== new Set(taskIds).size) throw new BadRequestException('Có công việc không hợp lệ (phải là công việc cấp cao, không phải Epic, của dự án này)');
    const changing = tasks.filter((t) => t.sprintId !== sprintId);
    if (changing.length === 0) return { moved: 0 };
    await this.prisma.task.updateMany({ where: { id: { in: changing.map((t) => t.id) } }, data: { sprintId } });
    for (const t of changing) {
      await this.activity.log({ taskId: t.id, userId: user.id, action: 'sprint_changed', detail: { from: await this.ref(t.sprintId), to: await this.ref(sprintId) } });
    }
    return { moved: changing.length };
  }

  async addTasksToSprint(user: AuthUser, sprintId: number, taskIds: number[]): Promise<{ moved: number }> {
    const sprint = await this.findOrThrow(sprintId);
    return this.moveTasks(user, sprint.projectId, sprintId, taskIds);
  }

  // ---------------------------------------------------------------- helpers

  private async ref(id: number | null): Promise<{ id: number; name: string } | null> {
    return id === null ? null : this.prisma.sprint.findUnique({ where: { id }, select: { id: true, name: true } });
  }

  private async findOrThrow(id: number): Promise<Sprint> {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) throw new NotFoundException('Không tìm thấy sprint');
    return sprint;
  }

  private assertRange(start?: string | null, end?: string | null): void {
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
  }

  private async statsFor(sprintIds: number[]): Promise<Map<number, SprintStats>> {
    const result = new Map<number, SprintStats>();
    if (sprintIds.length === 0) return result;
    const tasks = await this.prisma.task.findMany({
      where: { sprintId: { in: sprintIds }, ...PLANNABLE },
      select: { sprintId: true, storyPoints: true, status: { select: { category: true } } },
    });
    for (const t of tasks) {
      if (t.sprintId === null) continue;
      const stat = result.get(t.sprintId) ?? emptyStats();
      stat.taskCount += 1;
      stat.points += t.storyPoints ?? 0;
      if (t.status.category === 'done') {
        stat.doneCount += 1;
        stat.donePoints += t.storyPoints ?? 0;
      }
      result.set(t.sprintId, stat);
    }
    return result;
  }
}

function emptyStats(): SprintStats {
  return { taskCount: 0, doneCount: 0, points: 0, donePoints: 0 };
}
