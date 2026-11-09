import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Priority, Task } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { asPrisma, callArg, createPrismaMock, firstArgs, PrismaMock } from '../test-utils';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TasksService } from './tasks.service';

const PROJECT = { id: 1, name: 'Dự án A', createdById: 10 };

const admin: AuthUser = { id: 1, email: 'admin@x.vn', name: 'Admin', role: 'admin' };
const owner: AuthUser = { id: 10, email: 'owner@x.vn', name: 'Trưởng nhóm', role: 'leader' };
const otherLeader: AuthUser = { id: 11, email: 'l2@x.vn', name: 'Leader khác', role: 'leader' };
const assignee: AuthUser = { id: 20, email: 'm1@x.vn', name: 'Thành viên A', role: 'member' };
const otherMember: AuthUser = { id: 21, email: 'm2@x.vn', name: 'Thành viên B', role: 'member' };
const outsider: AuthUser = { id: 30, email: 'm3@x.vn', name: 'Người ngoài', role: 'member' };

/** Id người dùng là thành viên của PROJECT */
const MEMBER_IDS = new Set([10, 20, 21]);

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 5,
    projectId: 1,
    parentId: null,
    title: 'Làm trang đăng nhập',
    description: null,
    assigneeId: 20,
    creatorId: 10,
    status: 'todo',
    priority: 'medium',
    deadline: null,
    estimatedHours: null,
    actualHours: null,
    position: 0,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TasksService', () => {
  let prisma: PrismaMock;
  let activity: { log: jest.Mock };
  let notifications: { notify: jest.Mock };
  let realtime: { taskChanged: jest.Mock };
  let service: TasksService;

  beforeEach(() => {
    prisma = createPrismaMock();
    activity = { log: jest.fn().mockResolvedValue({}) };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    realtime = { taskChanged: jest.fn() };

    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockImplementation(({ where }: { where: { projectId_userId: { userId: number } } }) =>
      Promise.resolve(MEMBER_IDS.has(where.projectId_userId.userId) ? { projectId: 1, userId: where.projectId_userId.userId } : null),
    );
    prisma.user.findUnique.mockResolvedValue({ isActive: true });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.task.aggregate.mockResolvedValue({ _max: { position: 2 } });
    prisma.task.create.mockImplementation(({ data }: { data: Partial<Task> }) => Promise.resolve(buildTask({ id: 99, ...data })));
    prisma.task.update.mockImplementation(({ where, data }: { where: { id: number }; data: Partial<Task> }) =>
      Promise.resolve(buildTask({ id: where.id, ...data })),
    );

    const prismaService = asPrisma(prisma);
    service = new TasksService(
      prismaService,
      new ProjectAccessService(prismaService),
      activity as unknown as ActivityService,
      notifications as unknown as NotificationsService,
      realtime as unknown as RealtimeService,
    );
    // get() dựng lại chi tiết bằng nhiều truy vấn include — không thuộc phạm vi các test này
    jest.spyOn(service, 'get').mockResolvedValue({} as never);
  });

  describe('create', () => {
    const dto = { projectId: 1, title: 'Việc mới', assigneeId: 20 };

    it('member không được tạo task lớn (kiểm tra ở backend, không chỉ ẩn nút)', async () => {
      await expect(service.create(assignee, dto)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    describe('member thêm công việc con', () => {
      const subDto = { projectId: 1, parentId: 7, title: 'Việc con của tôi' };

      beforeEach(() => {
        prisma.task.findUnique.mockResolvedValue(buildTask({ id: 7, assigneeId: 20, title: 'Task lớn' }));
      });

      it('được thêm vào task lớn được giao cho mình, mặc định không giao ai', async () => {
        await service.create(assignee, subDto);
        const arg = callArg(prisma.task.create) as { data: Partial<Task> };
        expect(arg.data).toMatchObject({ parentId: 7, creatorId: 20, assigneeId: null });
      });

      it('được tự giao cho chính mình', async () => {
        await service.create(assignee, { ...subDto, assigneeId: 20 });
        const arg = callArg(prisma.task.create) as { data: Partial<Task> };
        expect(arg.data.assigneeId).toBe(20);
      });

      it('không được giao việc con cho người khác', async () => {
        await expect(service.create(assignee, { ...subDto, assigneeId: 21 })).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.task.create).not.toHaveBeenCalled();
      });

      it('không được thêm vào task lớn giao cho người khác', async () => {
        await expect(service.create(otherMember, subDto)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('không được thêm vào task lớn chưa giao ai', async () => {
        prisma.task.findUnique.mockResolvedValue(buildTask({ id: 7, assigneeId: null }));
        await expect(service.create(assignee, subDto)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('người ngoài dự án không được thêm', async () => {
        await expect(service.create(outsider, subDto)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('vẫn không thêm được công việc con của công việc con (chỉ 1 cấp)', async () => {
        prisma.task.findUnique.mockResolvedValue(buildTask({ id: 7, parentId: 3, assigneeId: 20 }));
        await expect(service.create(assignee, subDto)).rejects.toBeInstanceOf(BadRequestException);
      });

      it('báo cho trưởng nhóm dự án khi member thêm công việc con', async () => {
        await service.create(assignee, subDto);
        expect(notifications.notify).toHaveBeenCalledWith([expect.objectContaining({ userId: 10, type: 'subtask_added' })]);
      });
    });

    it('leader của dự án khác không được tạo task', async () => {
      await expect(service.create(otherLeader, dto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('leader sở hữu dự án tạo được: xếp cuối cột, ghi activity, báo cho người được giao', async () => {
      await service.create(owner, dto);

      const arg = callArg(prisma.task.create, 0) as { data: Partial<Task> };
      expect(arg.data).toMatchObject({ projectId: 1, title: 'Việc mới', assigneeId: 20, creatorId: 10, status: 'todo', position: 3, completedAt: null });
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ taskId: 99, userId: 10, action: 'task_created' }), prisma);
      expect(notifications.notify).toHaveBeenCalledWith([expect.objectContaining({ userId: 20, type: 'task_assigned', link: '/tasks/99' })]);
      expect(realtime.taskChanged).toHaveBeenCalledWith(1, 99);
    });

    it('admin tạo được trong mọi dự án', async () => {
      await expect(service.create(admin, dto)).resolves.toBeDefined();
    });

    it('tạo thẳng ở trạng thái done thì set completedAt', async () => {
      await service.create(owner, { ...dto, status: 'done' });
      const arg = callArg(prisma.task.create, 0) as { data: Partial<Task> };
      expect(arg.data.completedAt).toBeInstanceOf(Date);
    });

    it('không tự báo cho chính mình khi tự giao việc', async () => {
      await service.create(owner, { ...dto, assigneeId: 10 });
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('từ chối người thực hiện không thuộc dự án', async () => {
      await expect(service.create(owner, { ...dto, assigneeId: 30 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('từ chối người thực hiện đã bị vô hiệu hóa', async () => {
      prisma.user.findUnique.mockResolvedValue({ isActive: false });
      await expect(service.create(owner, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('từ chối công việc con của công việc con (chỉ 1 cấp)', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ id: 7, parentId: 3 }));
      await expect(service.create(owner, { ...dto, parentId: 7 })).rejects.toThrow('1 cấp');
    });

    it('từ chối công việc cha thuộc dự án khác', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ id: 7, projectId: 2 }));
      await expect(service.create(owner, { ...dto, parentId: 7 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('tạo subtask: ghi subtask_added trên task cha', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ id: 7 }));
      await service.create(owner, { ...dto, parentId: 7 });
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ taskId: 7, action: 'subtask_added' }), prisma);
    });
  });

  describe('update', () => {
    it('người được giao đổi sang done: set completedAt, chuyển xuống cuối cột, ghi activity', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'in_progress' }));

      await service.update(assignee, 5, { status: 'done' });

      const arg = callArg(prisma.task.update, 0) as { data: Partial<Task> };
      expect(arg.data.status).toBe('done');
      expect(arg.data.completedAt).toBeInstanceOf(Date);
      expect(arg.data.position).toBe(3);
      expect(activity.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'status_changed', detail: { from: 'in_progress', to: 'done' } }),
        prisma,
      );
    });

    it('rời khỏi done thì xóa completedAt', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'done', completedAt: new Date() }));
      await service.update(assignee, 5, { status: 'review' });
      const arg = callArg(prisma.task.update, 0) as { data: Partial<Task> };
      expect(arg.data.completedAt).toBeNull();
    });

    it('người được giao cập nhật được giờ làm thực tế', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await service.update(assignee, 5, { actualHours: 3.5 });
      const arg = callArg(prisma.task.update, 0) as { data: Partial<Task> };
      expect(arg.data.actualHours).toBe(3.5);
    });

    it.each([
      ['title', { title: 'Đổi tên' }],
      ['priority', { priority: 'urgent' as Priority }],
      ['assigneeId', { assigneeId: 21 }],
      ['deadline', { deadline: '2026-12-01T00:00:00.000Z' }],
      ['estimatedHours', { estimatedHours: 8 }],
      ['description', { description: 'x' }],
    ])('member được giao KHÔNG được sửa %s', async (_field, dto) => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await expect(service.update(assignee, 5, dto)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('member không được giao task thì không sửa được gì, kể cả status', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await expect(service.update(otherMember, 5, { status: 'done' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('người ngoài dự án không truy cập được', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await expect(service.update(outsider, 5, { status: 'done' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('leader dự án khác không sửa được task', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 11 }); // dù là thành viên
      await expect(service.update(otherLeader, 5, { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('leader sở hữu đổi deadline và người thực hiện: ghi activity + thông báo', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      prisma.user.findMany.mockResolvedValue([
        { id: 20, name: 'Thành viên A' },
        { id: 21, name: 'Thành viên B' },
      ]);

      await service.update(owner, 5, { assigneeId: 21, deadline: '2026-12-01T00:00:00.000Z' });

      const actions = firstArgs(activity.log).map((call) => (call as { action: string }).action);
      expect(actions).toEqual(expect.arrayContaining(['assignee_changed', 'deadline_changed']));
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ userId: 21, type: 'task_assigned' })]),
      );
    });

    it('không ghi gì khi không có thay đổi thực sự', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ title: 'Làm trang đăng nhập' }));
      await service.update(owner, 5, { title: 'Làm trang đăng nhập', priority: 'medium' });
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(activity.log).not.toHaveBeenCalled();
    });

    it('báo cho leader (không báo cho chính người đổi) khi member đổi trạng thái', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await service.update(assignee, 5, { status: 'review' });
      const notified = (callArg(notifications.notify, 0) as { userId: number }[]).map((n) => n.userId);
      expect(notified).toContain(10);
      expect(notified).not.toContain(20);
    });

    describe('người tạo công việc con (member)', () => {
      const ownSubtask = () => buildTask({ id: 8, parentId: 7, creatorId: 20, assigneeId: 20 });

      it('sửa được tiêu đề/ưu tiên công việc con do mình tạo', async () => {
        prisma.task.findUnique.mockResolvedValue(ownSubtask());
        await service.update(assignee, 8, { title: 'Tên mới', priority: 'high' });
        const arg = callArg(prisma.task.update) as { data: Partial<Task> };
        expect(arg.data).toMatchObject({ title: 'Tên mới', priority: 'high' });
      });

      it('không được giao công việc con cho người khác khi sửa', async () => {
        prisma.task.findUnique.mockResolvedValue(ownSubtask());
        await expect(service.update(assignee, 8, { assigneeId: 21 })).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('không sửa được công việc con do người khác tạo (kể cả khi được giao)', async () => {
        prisma.task.findUnique.mockResolvedValue(buildTask({ id: 8, parentId: 7, creatorId: 10, assigneeId: 20 }));
        await expect(service.update(assignee, 8, { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('không sửa được task lớn dù là người tạo (chỉ áp dụng cho công việc con)', async () => {
        prisma.task.findUnique.mockResolvedValue(buildTask({ id: 8, parentId: null, creatorId: 20, assigneeId: 20 }));
        await expect(service.update(assignee, 8, { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it('404 khi task không tồn tại', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.update(owner, 404, { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('move (Kanban)', () => {
    const column = [
      { id: 1, position: 0 },
      { id: 2, position: 1 },
      { id: 3, position: 2 },
    ];

    it('member không được giao không kéo được thẻ', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await expect(service.move(otherMember, 5, { status: 'done', position: 0 })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('chèn vào giữa cột đích và đánh số lại vị trí liên tục', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'todo' }));
      prisma.task.findMany.mockResolvedValue(column);

      await service.move(assignee, 5, { status: 'in_progress', position: 1 });

      const updates = firstArgs(prisma.task.update).map((call) => call as { where: { id: number }; data: Partial<Task> });
      // Thẻ 5 vào vị trí 1; thẻ 2 -> 2, thẻ 3 -> 3; thẻ 1 giữ nguyên nên không cập nhật
      expect(updates.find((u) => u.where.id === 5)?.data).toMatchObject({ status: 'in_progress', position: 1 });
      expect(updates.find((u) => u.where.id === 2)?.data).toEqual({ position: 2 });
      expect(updates.find((u) => u.where.id === 3)?.data).toEqual({ position: 3 });
      expect(updates.find((u) => u.where.id === 1)).toBeUndefined();
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'status_changed' }), prisma);
    });

    it('vị trí vượt quá độ dài cột thì xếp cuối', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      prisma.task.findMany.mockResolvedValue(column);
      await service.move(owner, 5, { status: 'review', position: 99 });
      const moved = firstArgs(prisma.task.update).map((c) => c as { where: { id: number }; data: Partial<Task> }).find((u) => u.where.id === 5);
      expect(moved?.data.position).toBe(3);
    });

    it('kéo vào done set completedAt; kéo ra khỏi done xóa completedAt', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'review' }));
      prisma.task.findMany.mockResolvedValue([]);
      await service.move(assignee, 5, { status: 'done', position: 0 });
      let moved = firstArgs(prisma.task.update).map((c) => c as { where: { id: number }; data: Partial<Task> }).find((u) => u.where.id === 5);
      expect(moved?.data.completedAt).toBeInstanceOf(Date);

      prisma.task.update.mockClear();
      prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'done', completedAt: new Date() }));
      await service.move(assignee, 5, { status: 'todo', position: 0 });
      moved = firstArgs(prisma.task.update).map((c) => c as { where: { id: number }; data: Partial<Task> }).find((u) => u.where.id === 5);
      expect(moved?.data.completedAt).toBeNull();
    });

    it('chỉ đổi thứ tự trong cùng cột thì không ghi activity đổi trạng thái', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'todo' }));
      prisma.task.findMany.mockResolvedValue(column);
      await service.move(assignee, 5, { status: 'todo', position: 0 });
      expect(activity.log).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('member (kể cả người được giao) không được xóa', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await expect(service.remove(assignee, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('leader dự án khác không được xóa', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await expect(service.remove(otherLeader, 5)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('member xóa được công việc con do mình tạo, nhưng không xóa được của người khác hay task lớn', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask({ id: 8, parentId: 7, creatorId: 20 }));
      await service.remove(assignee, 8);
      expect(prisma.task.delete).toHaveBeenCalledTimes(1);

      prisma.task.findUnique.mockResolvedValue(buildTask({ id: 8, parentId: 7, creatorId: 10 }));
      await expect(service.remove(assignee, 8)).rejects.toBeInstanceOf(ForbiddenException);
      prisma.task.findUnique.mockResolvedValue(buildTask({ id: 5, parentId: null, creatorId: 20 }));
      await expect(service.remove(assignee, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.delete).toHaveBeenCalledTimes(1);
    });

    it('leader sở hữu và admin xóa được', async () => {
      prisma.task.findUnique.mockResolvedValue(buildTask());
      await service.remove(owner, 5);
      await service.remove(admin, 5);
      expect(prisma.task.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('list', () => {
    const query = (overrides: Partial<ListTasksQueryDto> = {}): ListTasksQueryDto =>
      Object.assign(new ListTasksQueryDto(), overrides);

    beforeEach(() => {
      prisma.task.count.mockResolvedValue(35);
      prisma.task.findMany.mockResolvedValue([]);
    });

    it('member chỉ thấy task trong dự án của mình (lọc ở truy vấn)', async () => {
      await service.list(assignee, query());
      const where = (callArg(prisma.task.count, 0) as { where: { AND: unknown[] } }).where;
      expect(JSON.stringify(where)).toContain('"members":{"some":{"userId":20}}');
    });

    it('admin không bị giới hạn theo dự án', async () => {
      await service.list(admin, query());
      const where = (callArg(prisma.task.count, 0) as { where: { AND: unknown[] } }).where;
      expect(JSON.stringify(where)).not.toContain('members');
    });

    it('lọc theo dự án mà member không thuộc thì bị từ chối', async () => {
      await expect(service.list(outsider, query({ projectId: 1 }))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('mặc định không gồm subtask; includeSubtasks=true thì gồm', async () => {
      await service.list(admin, query());
      expect(JSON.stringify(callArg(prisma.task.count, 0))).toContain('"parentId":null');
      prisma.task.count.mockClear();
      await service.list(admin, query({ includeSubtasks: true }));
      expect(JSON.stringify(callArg(prisma.task.count, 0))).not.toContain('"parentId":null');
    });

    it('tính phân trang đúng', async () => {
      const result = await service.list(admin, query({ page: 2, pageSize: 10 }));
      expect(result).toMatchObject({ total: 35, page: 2, pageSize: 10, totalPages: 4 });
      const arg = callArg(prisma.task.findMany, 0) as { skip: number; take: number };
      expect(arg).toMatchObject({ skip: 10, take: 10 });
    });

    it('sắp xếp deadline tăng dần đẩy task không có deadline xuống cuối', async () => {
      prisma.task.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3); // tổng 5, có deadline 3
      const withRelations = (id: number) => ({
        ...buildTask({ id }),
        assignee: null,
        project: { id: 1, name: PROJECT.name },
        subtasks: [],
        _count: { comments: 0 },
      });
      prisma.task.findMany
        .mockResolvedValueOnce([withRelations(1), withRelations(2), withRelations(3)])
        .mockResolvedValueOnce([withRelations(4), withRelations(5)]);

      const result = await service.list(admin, query({ sortBy: 'deadline', order: 'asc', pageSize: 5 }));

      expect(result.items.map((t) => t.id)).toEqual([1, 2, 3, 4, 5]);
      const secondCall = JSON.stringify(callArg(prisma.task.findMany, 1));
      expect(secondCall).toContain('"deadline":null');
    });
  });
});
