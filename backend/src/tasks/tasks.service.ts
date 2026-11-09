import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BugSeverity, Environment, Prisma, ProjectStatus, Task, TaskType } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { NewNotification, NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService, ProjectRef } from '../projects/project-access.service';
import { BoardQueryDto } from './dto/board-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { scopeOfType } from '../statuses/default-statuses';
import { STATUS_SELECT } from '../statuses/status-view';
import { StatusesService } from '../statuses/statuses.service';
import { AttachmentCleanupService } from '../attachments/attachment-cleanup.service';
import { AutomationService } from '../automation/automation.service';
import { bucketOf, MyWorkBucket, myWorkWindow } from './my-work';
import { assigneesInclude, taskInclude, toTaskView } from './task-view';

const detailInclude = {
  assignees: assigneesInclude,
  status: { select: STATUS_SELECT },
  sprint: { select: { id: true, name: true, status: true } },
  epic: { select: { id: true, title: true } },
  fixRelease: { select: { id: true, version: true } },
  foundRelease: { select: { id: true, version: true } },
  creator: { select: USER_BRIEF_SELECT },
  project: { select: { id: true, name: true, createdById: true } },
  parent: { select: { id: true, title: true, assignees: { select: { userId: true } } } },
  subtasks: { include: taskInclude, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  dependencies: { select: { dependsOn: { select: { id: true, title: true, deadline: true, status: { select: STATUS_SELECT } } } } },
  dependents: { select: { task: { select: { id: true, title: true, status: { select: STATUS_SELECT } } } } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

/** Task kèm id những người được giao và trạng thái hiện tại (đủ để kiểm tra quyền và so sánh thay đổi) */
type TaskRow = Task & { assignees: { userId: number }[]; status: ProjectStatus };
const withAssigneeIds = { assignees: { select: { userId: true } }, status: true } satisfies Prisma.TaskInclude;

/** Các trường mà người được giao (không phải leader/admin) được phép sửa */
const ASSIGNEE_EDITABLE_FIELDS: ReadonlySet<string> = new Set(['statusId', 'actualHours']);

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly attachmentCleanup: AttachmentCleanupService,
    private readonly statuses: StatusesService,
    private readonly automation: AutomationService,
  ) {}

  // ---------------------------------------------------------------- queries

  async list(user: AuthUser, query: ListTasksQueryDto): Promise<Paginated<ReturnType<typeof toTaskView>>> {
    if (query.projectId !== undefined) await this.access.assertCanView(user, query.projectId);

    const filters: Prisma.TaskWhereInput[] = [];
    if (user.role !== 'admin') filters.push({ project: this.access.visibleProjectWhere(user) });
    if (query.projectId !== undefined) filters.push({ projectId: query.projectId });
    if (query.assigneeIds?.length) filters.push({ assignees: { some: { userId: { in: query.assigneeIds } } } });
    if (query.sprintId !== undefined) filters.push({ sprintId: query.sprintId });
    if (query.epicId !== undefined) filters.push({ epicId: query.epicId });
    if (query.fixReleaseId !== undefined) filters.push({ fixReleaseId: query.fixReleaseId });
    if (query.foundReleaseId !== undefined) filters.push({ foundReleaseId: query.foundReleaseId });
    if (query.environment) filters.push({ environment: query.environment });
    if (query.statusId !== undefined) filters.push({ statusId: query.statusId });
    if (query.statusCategory) filters.push({ status: { category: query.statusCategory } });
    if (query.types?.length) filters.push({ type: { in: query.types } });
    if (query.priority) filters.push({ priority: query.priority });
    if (!query.includeSubtasks) filters.push({ parentId: null });
    if (query.deadlineFrom || query.deadlineTo) {
      filters.push({
        deadline: {
          ...(query.deadlineFrom ? { gte: new Date(query.deadlineFrom) } : {}),
          ...(query.deadlineTo ? { lte: new Date(query.deadlineTo) } : {}),
        },
      });
    }
    if (query.overdue) filters.push({ status: { category: { not: 'done' } }, deadline: { lt: new Date() } });
    if (query.search) {
      filters.push({ OR: [{ title: { contains: query.search } }, { description: { contains: query.search } }] });
    }
    const where: Prisma.TaskWhereInput = { AND: filters };

    const total = await this.prisma.task.count({ where });
    const skip = (query.page - 1) * query.pageSize;
    const tasks = await this.findPage(where, query, skip, total);
    return toPaginated(tasks.map(toTaskView), total, query.page, query.pageSize);
  }

  async board(user: AuthUser, query: BoardQueryDto) {
    await this.access.assertCanView(user, query.projectId);
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: query.projectId,
        parentId: null,
        type: { not: 'epic' },
        ...(query.assigneeIds?.length ? { assignees: { some: { userId: { in: query.assigneeIds } } } } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      },
      include: taskInclude,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return tasks.map(toTaskView);
  }

  /**
   * "Hôm nay cần làm gì": việc của TÔI chưa xong (kể cả công việc con), chia nhóm quá hạn / hạn hôm nay /
   * đang làm / sắp tới 7 ngày theo ngày giờ Việt Nam. Epic không phải việc để làm nên bị loại.
   */
  async myWork(user: AuthUser, now: Date = new Date()) {
    const window = myWorkWindow(now);
    const mine: Prisma.TaskWhereInput = { assignees: { some: { userId: user.id } }, type: { not: 'epic' } };
    const [candidates, doneToday] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          ...mine,
          project: this.access.visibleProjectWhere(user),
          status: { category: { not: 'done' } },
          OR: [{ deadline: { lt: window.weekEnd } }, { status: { category: 'in_progress' } }],
        },
        include: taskInclude,
        orderBy: [{ deadline: 'asc' }, { priority: 'desc' }, { id: 'asc' }],
        take: 300,
      }),
      this.prisma.task.count({ where: { ...mine, completedAt: { gte: window.todayStart, lt: window.tomorrowStart } } }),
    ]);

    const groups: Record<MyWorkBucket, ReturnType<typeof toTaskView>[]> = { overdue: [], dueToday: [], inProgress: [], upcoming: [] };
    for (const task of candidates) {
      const bucket = bucketOf({ deadline: task.deadline, category: task.status.category }, window);
      if (bucket) groups[bucket].push(toTaskView(task));
    }
    return { date: window.todayStart.toISOString(), ...groups, doneToday };
  }

  async get(user: AuthUser, id: number) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: detailInclude });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    await this.access.assertCanView(user, task.projectId);

    const { subtasks, _count, assignees, parent, dependencies, dependents, ...rest } = task;
    return {
      ...rest,
      /** Phải chờ những việc này xong */
      dependsOn: dependencies.map((d) => d.dependsOn),
      /** Những việc đang chờ công việc này */
      blocking: dependents.map((d) => d.task),
      assignees: assignees.map((a) => a.user),
      // Người được giao của task cha (chỉ id) để frontend biết quyền thêm/bình luận công việc con
      parent: parent ? { id: parent.id, title: parent.title, assigneeIds: parent.assignees.map((a) => a.userId) } : null,
      subtasks: subtasks.map(toTaskView),
      subtaskTotal: subtasks.length,
      subtaskDone: subtasks.filter((s) => s.status.category === 'done').length,
      commentCount: _count.comments,
      attachmentCount: _count.attachments,
    };
  }

  // -------------------------------------------------------------- mutations

  async create(user: AuthUser, dto: CreateTaskDto) {
    const project = await this.access.assertCanView(user, dto.projectId);
    const canManage = this.access.canManage(user, project);
    // Thành viên chỉ được thêm công việc con (không tạo công việc lớn mới)
    if (!canManage && !dto.parentId) {
      throw new ForbiddenException('Chỉ trưởng nhóm của dự án hoặc quản trị viên mới tạo được công việc mới');
    }
    const parent = dto.parentId ? await this.assertValidParent(dto.parentId, dto.projectId) : null;
    const type = dto.type ?? 'task';
    if (parent && (type === 'epic' || type === 'story')) throw new BadRequestException('Công việc con chỉ có thể là Task hoặc Bug');
    this.assertBugFields(type, dto.severity, dto.environment);
    const assigneeIds = [...new Set(dto.assigneeIds ?? [])];
    if (!canManage && parent) {
      if (!this.isAssigned(parent, user.id)) {
        throw new ForbiddenException('Bạn chỉ được thêm công việc con vào công việc được giao cho mình');
      }
      this.assertSelfAssignment(user, assigneeIds, []);
    }
    await this.assertValidAssignees(project, assigneeIds);

    this.assertDateOrder(dto.startDate, dto.deadline);
    const status = await this.statuses.resolve(dto.projectId, scopeOfType(type), dto.statusId);
    const placement = await this.resolvePlacement(dto.projectId, type, parent?.id ?? null, dto.sprintId, dto.epicId);
    const releases = await this.resolveReleases(dto.projectId, type, dto.fixReleaseId, dto.foundReleaseId);
    const created = await this.prisma.$transaction(async (tx) => {
      const position = await this.nextPosition(tx, dto.projectId, status.id, parent?.id ?? null);
      const task = await tx.task.create({
        data: {
          projectId: dto.projectId,
          parentId: parent?.id ?? null,
          title: dto.title,
          description: dto.description ?? null,
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
          creatorId: user.id,
          type,
          statusId: status.id,
          storyPoints: dto.storyPoints ?? null,
          sprintId: placement.sprintId,
          epicId: placement.epicId,
          fixReleaseId: releases.fixReleaseId,
          foundReleaseId: releases.foundReleaseId,
          severity: type === 'bug' ? (dto.severity ?? 'major') : null,
          environment: type === 'bug' ? (dto.environment ?? null) : null,
          priority: dto.priority ?? 'medium',
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          deadline: dto.deadline ? new Date(dto.deadline) : null,
          estimatedHours: dto.estimatedHours ?? null,
          actualHours: dto.actualHours ?? null,
          position,
          completedAt: status.category === 'done' ? new Date() : null,
        },
      });
      await this.activity.log({ taskId: task.id, userId: user.id, action: 'task_created', detail: { title: task.title, type } }, tx);
      if (assigneeIds.length > 0) {
        await this.activity.log(
          { taskId: task.id, userId: user.id, action: 'assignee_changed', detail: { added: await this.userRefs(assigneeIds, tx), removed: [] } },
          tx,
        );
      }
      if (parent) {
        await this.activity.log(
          { taskId: parent.id, userId: user.id, action: 'subtask_added', detail: { subtaskId: task.id, title: task.title } },
          tx,
        );
      }
      return task;
    });

    const assigneeNames = new Map((await this.userRefs(assigneeIds)).map((u) => [u.id, u.name]));
    const notices: NewNotification[] = assigneeIds
      .filter((id) => id !== user.id)
      .map((id) => this.assignedNotification(id, created.title, created.id, created.projectId, assigneeNames.get(id)));
    // Thành viên thêm công việc con: báo cho trưởng nhóm dự án nắm
    if (!canManage && parent && project.createdById !== user.id) {
      notices.push({
        userId: project.createdById,
        type: 'subtask_added',
        message: `${user.name} đã thêm công việc con "${created.title}" vào "${parent.title}"`,
        link: `/tasks/${created.id}`,
        projectId: created.projectId,
      });
    }
    if (notices.length > 0) await this.notifications.notify(notices);
    this.realtime.taskChanged(created.projectId, created.id);
    // Quy tắc tự động chạy sau khi việc đã lưu; không bao giờ làm hỏng thao tác tạo
    await this.automation.handle({ type: 'task_created', taskId: created.id, actorId: user.id });
    if (assigneeIds.length > 0) await this.automation.handle({ type: 'task_assigned', taskId: created.id, actorId: user.id });
    return this.get(user, created.id);
  }

  async update(user: AuthUser, id: number, dto: UpdateTaskDto) {
    const task = await this.findTaskOrThrow(id);
    const project = await this.access.assertCanView(user, task.projectId);
    const canManage = this.access.canManage(user, project);
    // Người tạo công việc con (thành viên) được sửa đầy đủ công việc con của mình
    const canEditAll = canManage || this.isSubtaskCreator(user, task);

    if (!canEditAll) {
      // Người được giao là MỘT trong những người trong danh sách (không cần là người duy nhất)
      if (!this.isAssigned(task, user.id)) {
        throw new ForbiddenException('Bạn chỉ được cập nhật công việc được giao cho mình');
      }
      const disallowed = Object.entries(dto).filter(([key, value]) => value !== undefined && !ASSIGNEE_EDITABLE_FIELDS.has(key));
      if (disallowed.length > 0) {
        throw new ForbiddenException('Thành viên chỉ được cập nhật trạng thái và giờ làm của công việc được giao');
      }
    }

    // `assigneeIds` thay TOÀN BỘ danh sách: so với danh sách hiện tại để biết ai được thêm / bị bớt
    const currentIds = task.assignees.map((a) => a.userId);
    const nextIds = dto.assigneeIds === undefined ? currentIds : [...new Set(dto.assigneeIds)];
    const addedIds = nextIds.filter((uid) => !currentIds.includes(uid));
    const removedIds = currentIds.filter((uid) => !nextIds.includes(uid));
    const assigneesChanged = addedIds.length > 0 || removedIds.length > 0;
    if (assigneesChanged) {
      if (!canManage) this.assertSelfAssignment(user, addedIds, removedIds);
      // Chỉ kiểm tra người MỚI thêm: người đã được giao từ trước giữ nguyên dù sau đó rời dự án
      await this.assertValidAssignees(project, addedIds);
    }

    // Loại, trạng thái, Story Point, thông tin Bug
    const nextType: TaskType = dto.type ?? task.type;
    const typeChanged = nextType !== task.type;
    if (typeChanged && task.parentId !== null && (nextType === 'epic' || nextType === 'story')) {
      throw new BadRequestException('Công việc con chỉ có thể là Task hoặc Bug');
    }
    const nextSeverity = nextType !== 'bug' ? null : dto.severity !== undefined ? dto.severity : task.severity;
    const nextEnvironment = nextType !== 'bug' ? null : dto.environment !== undefined ? dto.environment : task.environment;
    this.assertBugFields(nextType, dto.severity, dto.environment);
    const nextScope = scopeOfType(nextType);
    let nextStatus: ProjectStatus = task.status;
    if (nextScope !== scopeOfType(task.type)) {
      nextStatus =
        dto.statusId !== undefined
          ? await this.statuses.resolve(task.projectId, nextScope, dto.statusId)
          : await this.statuses.mapToScope(task.projectId, nextScope, task.status.category);
    } else if (dto.statusId !== undefined && dto.statusId !== task.statusId) {
      nextStatus = await this.statuses.resolve(task.projectId, nextScope, dto.statusId);
    }

    // Sprint / Epic: epic và công việc con không thuộc sprint/epic; đổi sang epic thì tự gỡ
    const clearsPlacement = nextType === 'epic' || task.parentId !== null;
    const placementTouched = dto.sprintId !== undefined || dto.epicId !== undefined || (typeChanged && nextType === 'epic');
    const placement = placementTouched
      ? await this.resolvePlacement(
          task.projectId,
          nextType,
          task.parentId,
          clearsPlacement ? null : dto.sprintId === undefined ? task.sprintId : dto.sprintId,
          clearsPlacement ? null : dto.epicId === undefined ? task.epicId : dto.epicId,
        )
      : { sprintId: task.sprintId, epicId: task.epicId };

    // Phiên bản: foundRelease chỉ dành cho Bug (đổi khỏi Bug thì tự gỡ)
    const releasesTouched = dto.fixReleaseId !== undefined || dto.foundReleaseId !== undefined || (typeChanged && nextType !== 'bug');
    const releases = releasesTouched
      ? await this.resolveReleases(
          task.projectId,
          nextType,
          dto.fixReleaseId === undefined ? task.fixReleaseId : dto.fixReleaseId,
          nextType !== 'bug' ? null : dto.foundReleaseId === undefined ? task.foundReleaseId : dto.foundReleaseId,
        )
      : { fixReleaseId: task.fixReleaseId, foundReleaseId: task.foundReleaseId };

    const data: Prisma.TaskUncheckedUpdateInput = {};
    const logs: { action: Parameters<ActivityService['log']>[0]['action']; detail: Prisma.InputJsonValue }[] = [];

    if (dto.title !== undefined && dto.title !== task.title) {
      data.title = dto.title;
      logs.push({ action: 'title_changed', detail: { from: task.title, to: dto.title } });
    }
    if (dto.description !== undefined && (dto.description ?? null) !== task.description) {
      data.description = dto.description ?? null;
      logs.push({ action: 'description_changed', detail: {} });
    }
    if (dto.priority !== undefined && dto.priority !== task.priority) {
      data.priority = dto.priority;
      logs.push({ action: 'priority_changed', detail: { from: task.priority, to: dto.priority } });
    }
    if (dto.startDate !== undefined || dto.deadline !== undefined) {
      this.assertDateOrder(
        dto.startDate === undefined ? task.startDate?.toISOString() : dto.startDate,
        dto.deadline === undefined ? task.deadline?.toISOString() : dto.deadline,
      );
    }
    if (dto.startDate !== undefined) {
      const next = dto.startDate ? new Date(dto.startDate) : null;
      if ((next?.getTime() ?? null) !== (task.startDate?.getTime() ?? null)) {
        data.startDate = next;
        logs.push({ action: 'start_date_changed', detail: { from: task.startDate?.toISOString() ?? null, to: next?.toISOString() ?? null } });
      }
    }
    if (dto.deadline !== undefined) {
      const next = dto.deadline ? new Date(dto.deadline) : null;
      if ((next?.getTime() ?? null) !== (task.deadline?.getTime() ?? null)) {
        data.deadline = next;
        logs.push({ action: 'deadline_changed', detail: { from: task.deadline?.toISOString() ?? null, to: next?.toISOString() ?? null } });
      }
    }
    if (dto.estimatedHours !== undefined && (dto.estimatedHours ?? null) !== task.estimatedHours) {
      data.estimatedHours = dto.estimatedHours ?? null;
      logs.push({ action: 'hours_changed', detail: { field: 'estimatedHours', from: task.estimatedHours, to: dto.estimatedHours ?? null } });
    }
    if (dto.actualHours !== undefined && (dto.actualHours ?? null) !== task.actualHours) {
      data.actualHours = dto.actualHours ?? null;
      logs.push({ action: 'hours_changed', detail: { field: 'actualHours', from: task.actualHours, to: dto.actualHours ?? null } });
    }
    if (typeChanged) {
      data.type = nextType;
      logs.push({ action: 'type_changed', detail: { from: task.type, to: nextType } });
    }
    if (dto.storyPoints !== undefined && (dto.storyPoints ?? null) !== task.storyPoints) {
      data.storyPoints = dto.storyPoints ?? null;
      logs.push({ action: 'story_points_changed', detail: { from: task.storyPoints, to: dto.storyPoints ?? null } });
    }
    if (nextSeverity !== task.severity) {
      data.severity = nextSeverity;
      logs.push({ action: 'bug_info_changed', detail: { field: 'severity', from: task.severity, to: nextSeverity } });
    }
    if (nextEnvironment !== task.environment) {
      data.environment = nextEnvironment;
      logs.push({ action: 'bug_info_changed', detail: { field: 'environment', from: task.environment, to: nextEnvironment } });
    }
    if (placement.sprintId !== task.sprintId) {
      data.sprintId = placement.sprintId;
      logs.push({ action: 'sprint_changed', detail: { from: await this.sprintRef(task.sprintId), to: await this.sprintRef(placement.sprintId) } });
    }
    if (releases.fixReleaseId !== task.fixReleaseId || releases.foundReleaseId !== task.foundReleaseId) {
      data.fixReleaseId = releases.fixReleaseId;
      data.foundReleaseId = releases.foundReleaseId;
      logs.push({
        action: 'release_changed',
        detail: {
          fix: { from: await this.releaseRef(task.fixReleaseId), to: await this.releaseRef(releases.fixReleaseId) },
          found: { from: await this.releaseRef(task.foundReleaseId), to: await this.releaseRef(releases.foundReleaseId) },
        },
      });
    }
    if (placement.epicId !== task.epicId) {
      data.epicId = placement.epicId;
      logs.push({ action: 'epic_changed', detail: { from: await this.epicRef(task.epicId), to: await this.epicRef(placement.epicId) } });
    }
    if (assigneesChanged) {
      data.updatedAt = new Date(); // chỉ đổi người được giao vẫn làm "mới cập nhật"
      const names = await this.userRefs([...addedIds, ...removedIds]);
      logs.push({
        action: 'assignee_changed',
        detail: { added: names.filter((u) => addedIds.includes(u.id)), removed: names.filter((u) => removedIds.includes(u.id)) },
      });
    }

    const statusChanged = nextStatus.id !== task.statusId;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (statusChanged) {
        data.statusId = nextStatus.id;
        data.completedAt = this.completedAtFor(task, nextStatus);
        // Sang cột mới thì xếp cuối cột
        data.position = await this.nextPosition(tx, task.projectId, nextStatus.id, task.parentId);
        logs.push({ action: 'status_changed', detail: { from: { id: task.status.id, name: task.status.name }, to: { id: nextStatus.id, name: nextStatus.name } } });
      }
      if (Object.keys(data).length === 0) return task;
      if (removedIds.length > 0) await tx.taskAssignee.deleteMany({ where: { taskId: id, userId: { in: removedIds } } });
      if (addedIds.length > 0) await tx.taskAssignee.createMany({ data: addedIds.map((userId) => ({ taskId: id, userId })) });
      const result = await tx.task.update({ where: { id }, data });
      for (const entry of logs) {
        await this.activity.log({ taskId: id, userId: user.id, action: entry.action, detail: entry.detail }, tx);
      }
      return result;
    });

    // Chỉ người MỚI được thêm nhận thông báo "được giao"; người giữ nguyên không bị báo lại
    const addedNames = new Map((await this.userRefs(addedIds)).map((u) => [u.id, u.name]));
    const notices: NewNotification[] = addedIds.filter((uid) => uid !== user.id).map((uid) => this.assignedNotification(uid, updated.title, id, task.projectId, addedNames.get(uid)));
    if (statusChanged) notices.push(...this.statusNotifications(user, project, updated, nextStatus.name, nextIds));
    if (dto.deadline !== undefined && updated.deadline?.getTime() !== task.deadline?.getTime()) {
      for (const uid of nextIds.filter((x) => x !== user.id)) {
        notices.push({
          userId: uid,
          type: 'deadline_changed',
          message: `Deadline của "${updated.title}" đã được thay đổi`,
          link: this.taskLink(updated),
          projectId: updated.projectId,
        });
      }
    }
    await this.notifications.notify(notices);
    this.realtime.taskChanged(task.projectId, id);
    if (statusChanged) await this.automation.handle({ type: 'status_changed', taskId: id, actorId: user.id });
    if (addedIds.length > 0) await this.automation.handle({ type: 'task_assigned', taskId: id, actorId: user.id });
    return this.get(user, id);
  }

  async move(user: AuthUser, id: number, dto: MoveTaskDto) {
    const task = await this.findTaskOrThrow(id);
    const project = await this.access.assertCanView(user, task.projectId);
    if (!this.access.canManage(user, project) && !this.isAssigned(task, user.id)) {
      throw new ForbiddenException('Bạn chỉ được di chuyển công việc được giao cho mình');
    }

    const target = await this.statuses.resolve(task.projectId, scopeOfType(task.type), dto.statusId);
    const statusChanged = target.id !== task.statusId;
    const updated = await this.prisma.$transaction(async (tx) => {
      const column = await tx.task.findMany({
        where: { projectId: task.projectId, parentId: task.parentId, statusId: target.id, id: { not: id } },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true, position: true },
      });
      const index = Math.min(dto.position, column.length);
      const ordered: { id: number; position: number }[] = [...column];
      ordered.splice(index, 0, { id, position: -1 });

      let moved: Task = task;
      for (const [i, entry] of ordered.entries()) {
        if (entry.id === id) {
          moved = await tx.task.update({
            where: { id },
            data: {
              statusId: target.id,
              position: i,
              ...(statusChanged ? { completedAt: this.completedAtFor(task, target) } : {}),
            },
          });
        } else if (entry.position !== i) {
          await tx.task.update({ where: { id: entry.id }, data: { position: i } });
        }
      }
      if (statusChanged) {
        await this.activity.log(
          { taskId: id, userId: user.id, action: 'status_changed', detail: { from: { id: task.status.id, name: task.status.name }, to: { id: target.id, name: target.name } } },
          tx,
        );
      }
      return moved;
    });

    if (statusChanged) {
      await this.notifications.notify(this.statusNotifications(user, project, updated, target.name, task.assignees.map((a) => a.userId)));
    }
    this.realtime.taskChanged(task.projectId, id);
    if (statusChanged) await this.automation.handle({ type: 'status_changed', taskId: id, actorId: user.id });
    return this.get(user, id);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const task = await this.findTaskOrThrow(id);
    const project = await this.access.assertCanView(user, task.projectId);
    if (!this.access.canManage(user, project) && !this.isSubtaskCreator(user, task)) {
      throw new ForbiddenException('Chỉ trưởng nhóm của dự án, quản trị viên hoặc người tạo công việc con mới được xóa');
    }
    const targets = await this.attachmentCleanup.collectTaskTargets(id);
    await this.prisma.task.delete({ where: { id } });
    await this.attachmentCleanup.cleanup(targets);
    this.realtime.taskChanged(task.projectId, id);
  }

  // ---------------------------------------------------------------- helpers

  /** Công việc con do chính người dùng tạo (dành cho thành viên không phải leader/admin của dự án) */
  private isSubtaskCreator(user: AuthUser, task: Pick<Task, 'parentId' | 'creatorId'>): boolean {
    return task.parentId !== null && task.creatorId === user.id;
  }

  private isAssigned(task: { assignees: { userId: number }[] }, userId: number): boolean {
    return task.assignees.some((a) => a.userId === userId);
  }

  /** Thành viên chỉ được thêm/bớt CHÍNH MÌNH khỏi danh sách người được giao (không đụng tới người khác) */
  private assertSelfAssignment(user: AuthUser, addedIds: number[], removedIds: number[]): void {
    if ([...addedIds, ...removedIds].some((uid) => uid !== user.id)) {
      throw new ForbiddenException('Thành viên chỉ được giao công việc con cho chính mình');
    }
  }

  private async findTaskOrThrow(id: number): Promise<TaskRow> {
    const task = await this.prisma.task.findUnique({ where: { id }, include: withAssigneeIds });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }

  private async assertValidParent(parentId: number, projectId: number): Promise<TaskRow> {
    const parent = await this.prisma.task.findUnique({ where: { id: parentId }, include: withAssigneeIds });
    if (!parent || parent.projectId !== projectId) {
      throw new BadRequestException('Công việc cha không tồn tại trong dự án này');
    }
    if (parent.parentId !== null) {
      throw new BadRequestException('Công việc con không thể có công việc con (chỉ hỗ trợ 1 cấp)');
    }
    return parent;
  }

  /** Mọi người thực hiện phải là thành viên đang hoạt động của dự án */
  private async assertValidAssignees(project: ProjectRef, assigneeIds: number[]): Promise<void> {
    for (const assigneeId of assigneeIds) {
      const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { isActive: true } });
      if (!assignee?.isActive) throw new BadRequestException('Người thực hiện không tồn tại hoặc đã bị vô hiệu hóa');
      const isMember = assigneeId === project.createdById || (await this.access.isMember(project.id, assigneeId));
      if (!isMember) throw new BadRequestException('Người thực hiện phải là thành viên của dự án');
    }
  }

  /** Vào nhóm "done" thì ghi completedAt; rời khỏi thì xóa; đổi giữa hai trạng thái cùng nhóm "done" thì giữ nguyên */
  private completedAtFor(task: Pick<Task, 'completedAt'> & { status: { category: string } }, next: { category: string }): Date | null {
    if (next.category !== 'done') return null;
    return task.status.category === 'done' && task.completedAt ? task.completedAt : new Date();
  }

  /**
   * Sprint và Epic của một công việc. Chỉ công việc cấp cao, không phải Epic, mới thuộc sprint/epic;
   * sprint phải của đúng dự án và chưa kết thúc; epic phải là task loại epic của đúng dự án.
   */
  private async resolvePlacement(
    projectId: number,
    type: TaskType,
    parentId: number | null,
    sprintId: number | null | undefined,
    epicId: number | null | undefined,
  ): Promise<{ sprintId: number | null; epicId: number | null }> {
    const wantsSprint = sprintId !== undefined && sprintId !== null;
    const wantsEpic = epicId !== undefined && epicId !== null;
    if ((wantsSprint || wantsEpic) && (parentId !== null || type === 'epic')) {
      throw new BadRequestException(parentId !== null ? 'Công việc con không thuộc sprint hay epic riêng' : 'Epic không thuộc sprint hay epic khác');
    }
    if (wantsSprint) {
      const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId }, select: { projectId: true, status: true } });
      if (!sprint || sprint.projectId !== projectId) throw new BadRequestException('Sprint không thuộc dự án này');
      if (sprint.status === 'completed') throw new BadRequestException('Sprint đã kết thúc, không thể thêm công việc vào');
    }
    if (wantsEpic) {
      const epic = await this.prisma.task.findUnique({ where: { id: epicId }, select: { projectId: true, type: true } });
      if (!epic || epic.projectId !== projectId || epic.type !== 'epic') throw new BadRequestException('Epic không tồn tại trong dự án này');
    }
    return { sprintId: sprintId ?? null, epicId: epicId ?? null };
  }

  /** Ngày bắt đầu không được sau deadline */
  private assertDateOrder(start?: string | null, deadline?: string | null): void {
    if (start && deadline && new Date(start).getTime() > new Date(deadline).getTime()) {
      throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng deadline');
    }
  }

  /** Phiên bản sửa/phát hiện phải thuộc đúng dự án; "phát hiện ở" chỉ dành cho Bug */
  private async resolveReleases(
    projectId: number,
    type: TaskType,
    fixId: number | null | undefined,
    foundId: number | null | undefined,
  ): Promise<{ fixReleaseId: number | null; foundReleaseId: number | null }> {
    if (foundId !== undefined && foundId !== null && type !== 'bug') throw new BadRequestException('Phiên bản phát hiện chỉ dùng cho Bug');
    if (fixId !== undefined && fixId !== null && type === 'epic') throw new BadRequestException('Epic không gắn vào phiên bản phát hành');
    for (const id of [fixId, foundId]) {
      if (id === undefined || id === null) continue;
      const release = await this.prisma.release.findUnique({ where: { id }, select: { projectId: true } });
      if (!release || release.projectId !== projectId) throw new BadRequestException('Phiên bản không thuộc dự án này');
    }
    return { fixReleaseId: fixId ?? null, foundReleaseId: foundId ?? null };
  }

  private async releaseRef(id: number | null): Promise<{ id: number; version: string } | null> {
    return id === null ? null : this.prisma.release.findUnique({ where: { id }, select: { id: true, version: true } });
  }

  private async sprintRef(id: number | null): Promise<{ id: number; name: string } | null> {
    return id === null ? null : this.prisma.sprint.findUnique({ where: { id }, select: { id: true, name: true } });
  }

  private async epicRef(id: number | null): Promise<{ id: number; title: string } | null> {
    return id === null ? null : this.prisma.task.findUnique({ where: { id }, select: { id: true, title: true } });
  }

  /** Mức độ nghiêm trọng và môi trường chỉ có nghĩa với Bug */
  private assertBugFields(type: TaskType, severity: BugSeverity | null | undefined, environment: Environment | null | undefined): void {
    if (type !== 'bug' && ((severity ?? null) !== null || (environment ?? null) !== null)) {
      throw new BadRequestException('Mức độ nghiêm trọng và môi trường chỉ dùng cho Bug');
    }
  }

  private async nextPosition(
    tx: Prisma.TransactionClient,
    projectId: number,
    statusId: number,
    parentId: number | null,
  ): Promise<number> {
    const max = await tx.task.aggregate({ where: { projectId, statusId, parentId }, _max: { position: true } });
    return (max._max.position ?? -1) + 1;
  }

  /** {id, name} của các người dùng (để ghi lịch sử đọc được cả khi người đó bị xóa sau này) */
  private async userRefs(ids: number[], tx?: Prisma.TransactionClient): Promise<{ id: number; name: string }[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    return (tx ?? this.prisma).user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  }

  private taskLink(task: Pick<Task, 'id'>): string {
    return `/tasks/${task.id}`;
  }

  private assignedNotification(userId: number, title: string, linkTaskId: number, projectId: number, assigneeName?: string): NewNotification {
    return {
      userId,
      type: 'task_assigned',
      message: `Bạn được giao công việc "${title}"`,
      channelMessage: `${assigneeName ?? 'Một thành viên'} được giao công việc "${title}"`,
      link: `/tasks/${linkTaskId}`,
      projectId,
    };
  }

  /** Báo cho người tạo task và trưởng nhóm dự án (trừ người thao tác) khi đổi trạng thái */
  private statusNotifications(actor: AuthUser, project: ProjectRef, task: Task, statusName: string, assigneeIds: number[]): NewNotification[] {
    const recipients = new Set<number>([task.creatorId, project.createdById, ...assigneeIds]);
    recipients.delete(actor.id);
    return [...recipients].map((userId) => ({
      userId,
      type: 'status_changed',
      message: `${actor.name} chuyển "${task.title}" sang "${statusName}"`,
      link: this.taskLink(task),
      projectId: task.projectId,
    }));
  }

  /** Phân trang có sắp xếp; deadline tăng dần luôn đặt task không có deadline xuống cuối */
  private async findPage(where: Prisma.TaskWhereInput, query: ListTasksQueryDto, skip: number, total: number) {
    const { sortBy, order, pageSize } = query;
    const primary: Prisma.TaskOrderByWithRelationInput[] =
      sortBy === 'status' ? [{ status: { category: order } }, { status: { position: order } }] : [{ [sortBy]: order }];
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [...primary, { id: 'desc' }];

    if (!(sortBy === 'deadline' && order === 'asc')) {
      return this.prisma.task.findMany({ where, include: taskInclude, orderBy, skip, take: pageSize });
    }

    // MySQL xếp NULL lên đầu khi ASC => tách 2 nhóm: có deadline (ASC) rồi không có deadline
    const withDeadline: Prisma.TaskWhereInput = { AND: [where, { deadline: { not: null } }] };
    const withoutDeadline: Prisma.TaskWhereInput = { AND: [where, { deadline: null }] };
    const withCount = await this.prisma.task.count({ where: withDeadline });
    const noDeadlineOrder: Prisma.TaskOrderByWithRelationInput[] = [{ id: 'desc' }];

    if (skip >= withCount) {
      return this.prisma.task.findMany({ where: withoutDeadline, include: taskInclude, orderBy: noDeadlineOrder, skip: skip - withCount, take: pageSize });
    }
    const first = await this.prisma.task.findMany({ where: withDeadline, include: taskInclude, orderBy, skip, take: pageSize });
    const remaining = Math.min(pageSize - first.length, total - withCount);
    if (remaining <= 0) return first;
    const rest = await this.prisma.task.findMany({ where: withoutDeadline, include: taskInclude, orderBy: noDeadlineOrder, take: remaining });
    return [...first, ...rest];
  }
}
