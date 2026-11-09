import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { AutomationService } from './automation.service';
import { matches, parseActions, parseConditions, renderTemplate } from './rules';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };

describe('rules (hàm thuần)', () => {
  it('matches: AND giữa các điều kiện, không có điều kiện = luôn khớp', () => {
    const task = { statusId: 4, type: 'bug' as const, priority: 'high' as const };
    expect(matches({}, task)).toBe(true);
    expect(matches({ statusId: 4, type: 'bug' }, task)).toBe(true);
    expect(matches({ statusId: 4, priority: 'low' }, task)).toBe(false);
    expect(matches({ type: 'story' }, task)).toBe(false);
  });

  it('parseConditions: từ chối khóa lạ / giá trị sai', () => {
    expect(parseConditions(undefined)).toEqual({ ok: true, value: {} });
    expect(parseConditions({ statusId: 3, priority: 'urgent' })).toEqual({ ok: true, value: { statusId: 3, priority: 'urgent' } });
    expect(parseConditions({ foo: 1 }).ok).toBe(false);
    expect(parseConditions({ priority: 'x' }).ok).toBe(false);
    expect(parseConditions({ statusId: '3' }).ok).toBe(false);
    expect(parseConditions([]).ok).toBe(false);
  });

  it('parseActions: kiểm tra từng loại hành động và giới hạn', () => {
    expect(parseActions([{ type: 'set_status', statusId: 2 }, { type: 'assign', userIds: [1, 1, 2] }, { type: 'set_priority', priority: 'high' }, { type: 'add_comment', text: ' Xin chào ' }, { type: 'notify', toLeader: true, message: 'Có việc' }])).toMatchObject({
      ok: true,
      value: [{ type: 'set_status', statusId: 2 }, { type: 'assign', userIds: [1, 2] }, { type: 'set_priority', priority: 'high' }, { type: 'add_comment', text: 'Xin chào' }, { type: 'notify', toLeader: true, message: 'Có việc' }],
    });
    for (const bad of [[], 'x', [{ type: 'hack' }], [{ type: 'assign', userIds: [] }], [{ type: 'set_priority', priority: 'x' }], [{ type: 'add_comment', text: '  ' }], [{ type: 'notify', message: 'x' }], [{ type: 'set_status' }], Array.from({ length: 7 }, () => ({ type: 'set_priority', priority: 'low' }))]) {
      expect(parseActions(bad).ok).toBe(false);
    }
  });

  it('renderTemplate: thay biến, giữ nguyên biến lạ', () => {
    expect(renderTemplate('{{user}} xong "{{title}}" ({{status}}) {{x}}', { user: 'An', title: 'Việc A', status: 'Xong' })).toBe('An xong "Việc A" (Xong) {{x}}');
  });
});

describe('AutomationService', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let activity: { log: jest.Mock };
  let service: AutomationService;
  const TASK = {
    id: 5,
    projectId: 1,
    title: 'Việc A',
    type: 'task',
    priority: 'medium',
    statusId: 1,
    parentId: null,
    completedAt: null,
    status: { id: 1, name: 'Cần làm', category: 'todo' },
    assignees: [],
    project: { id: 1, name: 'Dự án', createdById: 10 },
  };
  const rule = (over: object = {}) => ({ id: 1, projectId: 1, name: 'Quy tắc', enabled: true, trigger: 'status_changed', conditions: {}, actions: [], runCount: 0, lastRunAt: null, createdById: 10, createdAt: new Date(), updatedAt: new Date(), ...over });

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    activity = { log: jest.fn().mockResolvedValue({}) };
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'Dự án', createdById: 10 });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.task.findUnique.mockResolvedValue(TASK);
    prisma.task.findUniqueOrThrow.mockResolvedValue({ statusId: 1, completedAt: null, parentId: null, priority: 'medium' });
    prisma.task.aggregate.mockResolvedValue({ _max: { position: 2 } });
    prisma.task.update.mockResolvedValue({});
    prisma.projectStatus.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
      Promise.resolve(where.id === 9 ? { id: 9, projectId: 1, scope: 'task', name: 'Chờ duyệt', category: 'in_progress' } : where.id === 11 ? { id: 11, projectId: 1, scope: 'bug', name: 'Mới', category: 'todo' } : { id: 1, projectId: 1, scope: 'task', name: 'Cần làm', category: 'todo' }),
    );
    prisma.projectStatus.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({ name: 'An' });
    prisma.user.findMany.mockResolvedValue([{ id: 21, name: 'B' }]);
    prisma.taskAssignee.findMany.mockResolvedValue([]);
    prisma.taskAssignee.createMany.mockResolvedValue({ count: 1 });
    prisma.comment.create.mockResolvedValue({});
    prisma.automationRule.findMany.mockResolvedValue([]);
    prisma.automationRule.update.mockResolvedValue({});
    const p = asPrisma(prisma);
    service = new AutomationService(p, new ProjectAccessService(p), activity as unknown as ActivityService, { notify } as unknown as NotificationsService, { taskChanged: jest.fn() } as unknown as RealtimeService);
  });

  describe('quản lý quy tắc', () => {
    const dto = { name: 'R', trigger: 'status_changed' as const, conditions: { statusId: 1 }, actions: [{ type: 'set_priority', priority: 'high' }] };

    it('member xem được nhưng không tạo/sửa/xóa', async () => {
      prisma.automationRule.findMany.mockResolvedValue([rule()]);
      await expect(service.list(member, 1)).resolves.toHaveLength(1);
      await expect(service.create(member, 1, dto)).rejects.toBeInstanceOf(ForbiddenException);
      prisma.automationRule.findUnique.mockResolvedValue(rule());
      await expect(service.update(member, 1, { enabled: false })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(member, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('tạo quy tắc hợp lệ; điều kiện/hành động sai hình dạng bị từ chối', async () => {
      prisma.automationRule.create.mockImplementation(({ data }: { data: object }) => Promise.resolve(rule(data)));
      await expect(service.create(owner, 1, dto)).resolves.toMatchObject({ name: 'R', trigger: 'status_changed' });
      await expect(service.create(owner, 1, { ...dto, actions: [] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create(owner, 1, { ...dto, conditions: { x: 1 } })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('trạng thái hoặc người của dự án khác bị từ chối', async () => {
      prisma.projectStatus.count.mockResolvedValue(0);
      await expect(service.create(owner, 1, { ...dto, actions: [{ type: 'set_status', statusId: 99 }] })).rejects.toThrow(/không thuộc dự án/);
      prisma.projectStatus.count.mockResolvedValue(1);
      prisma.projectMember.findMany.mockResolvedValue([]);
      prisma.project.findUniqueOrThrow.mockResolvedValue({ createdById: 10 });
      await expect(service.create(owner, 1, { ...dto, actions: [{ type: 'assign', userIds: [77] }] })).rejects.toThrow(/thành viên/);
    });

    it('không tồn tại => 404', async () => {
      prisma.automationRule.findUnique.mockResolvedValue(null);
      await expect(service.remove(owner, 9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('engine', () => {
    const event = { type: 'status_changed' as const, taskId: 5, actorId: 20 };
    const run = async (rules: object[]) => {
      prisma.automationRule.findMany.mockResolvedValue(rules);
      await service.handle(event);
    };

    it('chỉ chạy quy tắc bật và đúng sự kiện (truy vấn lọc theo trigger + enabled)', async () => {
      await run([]);
      expect(callArg(prisma.automationRule.findMany)).toMatchObject({ where: { projectId: 1, trigger: 'status_changed', enabled: true } });
    });

    it('điều kiện không khớp thì không làm gì', async () => {
      await run([rule({ conditions: { priority: 'urgent' }, actions: [{ type: 'set_priority', priority: 'low' }] })]);
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.automationRule.update).not.toHaveBeenCalled();
    });

    it('đổi trạng thái: cập nhật statusId, vị trí cuối cột, ghi lịch sử đánh dấu automation và tăng bộ đếm', async () => {
      await run([rule({ actions: [{ type: 'set_status', statusId: 9 }] })]);
      expect(callArg(prisma.task.update)).toMatchObject({ where: { id: 5 }, data: { statusId: 9, position: 3, completedAt: null } });
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'status_changed', detail: expect.objectContaining({ by: 'automation' }) as object }));
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'automation_applied', detail: expect.objectContaining({ rule: { id: 1, name: 'Quy tắc' } }) as object }));
      expect(callArg(prisma.automationRule.update)).toMatchObject({ data: { runCount: { increment: 1 } } });
    });

    it('bỏ qua có lý do khi trạng thái sai bộ (Bug ↔ công việc) hoặc đã ở đúng trạng thái; không ghi automation_applied nếu không làm gì', async () => {
      await run([rule({ actions: [{ type: 'set_status', statusId: 11 }, { type: 'set_status', statusId: 1 }] })]);
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(activity.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'automation_applied' }));
      expect(prisma.automationRule.update).toHaveBeenCalled(); // vẫn tính là đã chạy
    });

    it('giao việc cho thành viên hợp lệ chưa được giao, báo cho họ', async () => {
      await run([rule({ actions: [{ type: 'assign', userIds: [21] }] })]);
      expect(callArg(prisma.taskAssignee.createMany)).toMatchObject({ data: [{ taskId: 5, userId: 21 }] });
      expect((callArg(notify) as { userId: number; type: string }[])[0]).toMatchObject({ userId: 21, type: 'task_assigned' });
      // truy vấn người nhận phải giới hạn trong thành viên dự án và đang hoạt động
      expect(callArg(prisma.user.findMany)).toMatchObject({ where: { isActive: true } });
    });

    it('bình luận tự động ký tên người tạo quy tắc kèm biến đã thay; thông báo cho trưởng nhóm', async () => {
      await run([rule({ actions: [{ type: 'add_comment', text: '{{user}} vừa đổi "{{title}}" sang {{status}}' }, { type: 'notify', toLeader: true, message: 'Cần xem: {{title}}' }] })]);
      expect(callArg(prisma.comment.create)).toMatchObject({ data: { taskId: 5, userId: 10, content: '🤖 An vừa đổi "Việc A" sang Cần làm' } });
      expect((callArg(notify) as { message: string }[])[0]?.message).toBe('Cần xem: Việc A');
    });

    it('một hành động lỗi không chặn các hành động sau; engine không bao giờ ném lỗi', async () => {
      prisma.comment.create.mockRejectedValue(new Error('db down'));
      await run([rule({ actions: [{ type: 'add_comment', text: 'a' }, { type: 'set_priority', priority: 'urgent' }] })]);
      expect(callArg(prisma.task.update)).toMatchObject({ data: { priority: 'urgent' } });
      prisma.automationRule.findMany.mockRejectedValue(new Error('boom'));
      await expect(service.handle(event)).resolves.toBeUndefined();
    });

    it('điều kiện so với trạng thái lúc xảy ra sự kiện: quy tắc sau không khớp thêm nhờ thay đổi của quy tắc trước (không có chuỗi A→B→A)', async () => {
      await run([
        rule({ id: 1, conditions: { statusId: 1 }, actions: [{ type: 'set_status', statusId: 9 }] }), // A: Cần làm -> Chờ duyệt
        rule({ id: 2, conditions: { statusId: 9 }, actions: [{ type: 'set_status', statusId: 1 }] }), // B: Chờ duyệt -> Cần làm
      ]);
      expect(prisma.task.update).toHaveBeenCalledTimes(1);
      expect(callArg(prisma.task.update)).toMatchObject({ data: { statusId: 9 } });
    });

    it('không kích hoạt dây chuyền: thao tác của engine không gọi lại handle()', async () => {
      const spy = jest.spyOn(service, 'handle');
      await run([rule({ actions: [{ type: 'set_status', statusId: 9 }] })]);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
