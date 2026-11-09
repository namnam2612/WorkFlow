import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';
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
import { STATUS_LABEL_VI } from './task-labels';
import { AttachmentCleanupService } from '../attachments/attachment-cleanup.service';
import { assigneesInclude, taskInclude, toTaskView } from './task-view';

const detailInclude = {
  assignees: assigneesInclude,
  creator: { select: USER_BRIEF_SELECT },
  project: { select: { id: true, name: true, createdById: true } },
  parent: { select: { id: true, title: true, assignees: { select: { userId: true } } } },
  subtasks: { include: taskInclude, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

/** Task kèm id những người được giao (đủ để kiểm tra quyền và so sánh thay đổi) */
type TaskRow = Task & { assignees: { userId: number }[] };
const withAssigneeIds = { assignees: { select: { userId: true } } } satisfies Prisma.TaskInclude;

/** Các trường mà người được giao (không phải leader/admin) được phép sửa */
const ASSIGNEE_EDITABLE_FIELDS: ReadonlySet<string> = new Set(['status', 'actualHours']);

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly attachmentCleanup: AttachmentCleanupService,
  ) {}

  // ---------------------------------------------------------------- queries

  async list(user: AuthUser, query: ListTasksQueryDto): Promise<Paginated<ReturnType<typeof toTaskView>>> {
    if (query.projectId !== undefined) await this.access.assertCanView(user, query.projectId);

    const filters: Prisma.TaskWhereInput[] = [];
    if (user.role !== 'admin') filters.push({ project: this.access.visibleProjectWhere(user) });
    if (query.projectId !== undefined) filters.push({ projectId: query.projectId });
    if (query.assigneeIds?.length) filters.push({ assignees: { some: { userId: { in: query.assigneeIds } } } });
    if (query.status) filters.push({ status: query.status });
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
    if (query.overdue) filters.push({ status: { not: 'done' }, deadline: { lt: new Date() } });
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
        ...(query.assigneeIds?.length ? { assignees: { some: { userId: { in: query.assigneeIds } } } } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      },
      include: taskInclude,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return tasks.map(toTaskView);
  }

  async get(user: AuthUser, id: number) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: detailInclude });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    await this.access.assertCanView(user, task.projectId);

    const { subtasks, _count, assignees, parent, ...rest } = task;
    return {
      ...rest,
      assignees: assignees.map((a) => a.user),
      // Người được giao của task cha (chỉ id) để frontend biết quyền thêm/bình luận công việc con
      parent: parent ? { id: parent.id, title: parent.title, assigneeIds: parent.assignees.map((a) => a.userId) } : null,
      subtasks: subtasks.map(toTaskView),
      subtaskTotal: subtasks.length,
      subtaskDone: subtasks.filter((s) => s.status === 'done').length,
      commentCount: _count.comments,
      attachmentCount: _count.attachments,
    };
  }

  // -------------------------------------------------------------- mutations

  async create(user: AuthUser, dto: CreateTaskDto) {
    const project = await this.access.assertCanView(user, dto.projectId);
    const canManage = this.access.canManage(user, project);
    const parent = dto.parentId ? await this.assertValidParent(dto.parentId, dto.projectId) : null;
<<<<<<< HEAD
    const assigneeIds = [...new Set(dto.assigneeIds ?? [])];
    if (!canManage && parent) {
      if (!this.isAssigned(parent, user.id)) {
        throw new ForbiddenException('Bạn chỉ được thêm công việc con vào công việc được giao cho mình');
      }
      this.assertSelfAssignment(user, assigneeIds, []);
    }
    await this.assertValidAssignees(project, assigneeIds);
=======
    // Người không quản lý dự án chỉ được tạo công việc cho chính mình
    let assigneeId = dto.assigneeId;
    if (!canManage) {
      if (parent && parent.assigneeId !== user.id) {
        throw new ForbiddenException('Bạn chỉ được thêm công việc con vào công việc được giao cho mình');
      }
      this.assertSelfAssignment(user, dto.assigneeId);
      // Công việc lớn tự giao cho người tạo; công việc con được phép để trống
      if (!parent) assigneeId = user.id;
    }
    await this.assertValidAssignee(project, assigneeId);
>>>>>>> origin/main

    const status = dto.status ?? 'todo';
    const created = await this.prisma.$transaction(async (tx) => {
      const position = await this.nextPosition(tx, dto.projectId, status, parent?.id ?? null);
      const task = await tx.task.create({
        data: {
          projectId: dto.projectId,
          parentId: parent?.id ?? null,
          title: dto.title,
          description: dto.description ?? null,
<<<<<<< HEAD
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
=======
          assigneeId: assigneeId ?? null,
>>>>>>> origin/main
          creatorId: user.id,
          status,
          priority: dto.priority ?? 'medium',
          deadline: dto.deadline ? new Date(dto.deadline) : null,
          estimatedHours: dto.estimatedHours ?? null,
          actualHours: dto.actualHours ?? null,
          position,
          completedAt: status === 'done' ? new Date() : null,
        },
      });
      await this.activity.log({ taskId: task.id, userId: user.id, action: 'task_created', detail: { title: task.title } }, tx);
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

    const notices: NewNotification[] = assigneeIds
      .filter((id) => id !== user.id)
      .map((id) => this.assignedNotification(id, created.title, created.id));
    // Thành viên thêm công việc con: báo cho trưởng nhóm dự án nắm
    if (!canManage && parent && project.createdById !== user.id) {
      notices.push({
        userId: project.createdById,
        type: 'subtask_added',
        message: `${user.name} đã thêm công việc con "${created.title}" vào "${parent.title}"`,
        link: `/tasks/${created.id}`,
      });
    }
    if (notices.length > 0) await this.notifications.notify(notices);
    this.realtime.taskChanged(created.projectId, created.id);
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
    if (assigneesChanged) {
      data.updatedAt = new Date(); // chỉ đổi người được giao vẫn làm "mới cập nhật"
      const names = await this.userRefs([...addedIds, ...removedIds]);
      logs.push({
        action: 'assignee_changed',
        detail: { added: names.filter((u) => addedIds.includes(u.id)), removed: names.filter((u) => removedIds.includes(u.id)) },
      });
    }

    const statusChanged = dto.status !== undefined && dto.status !== task.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (statusChanged && dto.status) {
        data.status = dto.status;
        data.completedAt = dto.status === 'done' ? new Date() : null;
        // Sang cột mới thì xếp cuối cột
        data.position = await this.nextPosition(tx, task.projectId, dto.status, task.parentId);
        logs.push({ action: 'status_changed', detail: { from: task.status, to: dto.status } });
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
    const notices: NewNotification[] = addedIds.filter((uid) => uid !== user.id).map((uid) => this.assignedNotification(uid, updated.title, id));
    if (statusChanged && dto.status) notices.push(...this.statusNotifications(user, project, updated, dto.status, nextIds));
    if (dto.deadline !== undefined && updated.deadline?.getTime() !== task.deadline?.getTime()) {
      for (const uid of nextIds.filter((x) => x !== user.id)) {
        notices.push({
          userId: uid,
          type: 'deadline_changed',
          message: `Deadline của "${updated.title}" đã được thay đổi`,
          link: this.taskLink(updated),
        });
      }
    }
    await this.notifications.notify(notices);
    this.realtime.taskChanged(task.projectId, id);
    return this.get(user, id);
  }

  async move(user: AuthUser, id: number, dto: MoveTaskDto) {
    const task = await this.findTaskOrThrow(id);
    const project = await this.access.assertCanView(user, task.projectId);
    if (!this.access.canManage(user, project) && !this.isAssigned(task, user.id)) {
      throw new ForbiddenException('Bạn chỉ được di chuyển công việc được giao cho mình');
    }

    const statusChanged = dto.status !== task.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const column = await tx.task.findMany({
        where: { projectId: task.projectId, parentId: task.parentId, status: dto.status, id: { not: id } },
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
              status: dto.status,
              position: i,
              ...(statusChanged ? { completedAt: dto.status === 'done' ? new Date() : null } : {}),
            },
          });
        } else if (entry.position !== i) {
          await tx.task.update({ where: { id: entry.id }, data: { position: i } });
        }
      }
      if (statusChanged) {
        await this.activity.log(
          { taskId: id, userId: user.id, action: 'status_changed', detail: { from: task.status, to: dto.status } },
          tx,
        );
      }
      return moved;
    });

    if (statusChanged) {
      await this.notifications.notify(this.statusNotifications(user, project, updated, dto.status, task.assignees.map((a) => a.userId)));
    }
    this.realtime.taskChanged(task.projectId, id);
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

<<<<<<< HEAD
  private isAssigned(task: { assignees: { userId: number }[] }, userId: number): boolean {
    return task.assignees.some((a) => a.userId === userId);
  }

  /** Thành viên chỉ được thêm/bớt CHÍNH MÌNH khỏi danh sách người được giao (không đụng tới người khác) */
  private assertSelfAssignment(user: AuthUser, addedIds: number[], removedIds: number[]): void {
    if ([...addedIds, ...removedIds].some((uid) => uid !== user.id)) {
      throw new ForbiddenException('Thành viên chỉ được giao công việc con cho chính mình');
=======
  /** Thành viên chỉ được giao việc cho chính mình hoặc để trống */
  private assertSelfAssignment(user: AuthUser, assigneeId: number | null | undefined): void {
    if (assigneeId !== null && assigneeId !== undefined && assigneeId !== user.id) {
      throw new ForbiddenException('Bạn chỉ được giao công việc cho chính mình');
>>>>>>> origin/main
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

  private async nextPosition(
    tx: Prisma.TransactionClient,
    projectId: number,
    status: TaskStatus,
    parentId: number | null,
  ): Promise<number> {
    const max = await tx.task.aggregate({ where: { projectId, status, parentId }, _max: { position: true } });
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

  private assignedNotification(userId: number, title: string, linkTaskId: number): NewNotification {
    return { userId, type: 'task_assigned', message: `Bạn được giao công việc "${title}"`, link: `/tasks/${linkTaskId}` };
  }

  /** Báo cho người tạo task và trưởng nhóm dự án (trừ người thao tác) khi đổi trạng thái */
  private statusNotifications(actor: AuthUser, project: ProjectRef, task: Task, status: TaskStatus, assigneeIds: number[]): NewNotification[] {
    const recipients = new Set<number>([task.creatorId, project.createdById, ...assigneeIds]);
    recipients.delete(actor.id);
    return [...recipients].map((userId) => ({
      userId,
      type: 'status_changed',
      message: `${actor.name} chuyển "${task.title}" sang "${STATUS_LABEL_VI[status]}"`,
      link: this.taskLink(task),
    }));
  }

  /** Phân trang có sắp xếp; deadline tăng dần luôn đặt task không có deadline xuống cuối */
  private async findPage(where: Prisma.TaskWhereInput, query: ListTasksQueryDto, skip: number, total: number) {
    const { sortBy, order, pageSize } = query;
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [{ [sortBy]: order }, { id: 'desc' }];

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
