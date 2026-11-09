import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AttachmentCleanupService } from '../attachments/attachment-cleanup.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { SlackService } from '../notifications/slack.service';
import { asPrisma, callArg, createPrismaMock, firstArgs, PrismaMock } from '../test-utils';
import { ProjectAccessService } from './project-access.service';
import { ProjectsService } from './projects.service';

const PROJECT = { id: 1, name: 'Dự án A', createdById: 10 };
const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const otherLeader: AuthUser = { id: 11, email: 'o2@x.vn', name: 'Leader khác', role: 'leader' };

describe('ProjectsService.removeMember - gỡ khỏi danh sách người được giao', () => {
  let prisma: PrismaMock;
  let activity: { log: jest.Mock };
  let service: ProjectsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    activity = { log: jest.fn().mockResolvedValue({}) };
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.projectMember.delete.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ id: 20, name: 'Thành viên A' });
    prisma.taskAssignee.findMany.mockResolvedValue([{ taskId: 5 }, { taskId: 6 }]);
    prisma.taskAssignee.deleteMany.mockResolvedValue({ count: 2 });
    const prismaService = asPrisma(prisma);
    service = new ProjectsService(
      prismaService,
      new ProjectAccessService(prismaService),
      { notify: jest.fn() } as unknown as NotificationsService,
      activity as unknown as ActivityService,
      {} as unknown as AttachmentCleanupService,
      { post: jest.fn().mockResolvedValue(true) } as unknown as SlackService,
    );
    jest.spyOn(service, 'get').mockResolvedValue({} as never);
  });

  it('chỉ gỡ người này khỏi các task của dự án (những người khác trong task giữ nguyên) và ghi lịch sử từng task', async () => {
    await service.removeMember(owner, 1, 20);
    expect(callArg(prisma.taskAssignee.deleteMany)).toEqual({ where: { userId: 20, task: { projectId: 1 } } });
    const logs = firstArgs(activity.log) as { taskId: number; action: string; detail: unknown }[];
    expect(logs.map((l) => l.taskId)).toEqual([5, 6]);
    expect(logs[0]).toMatchObject({
      action: 'assignee_changed',
      detail: { added: [], removed: [{ id: 20, name: 'Thành viên A' }], reason: 'removed_from_project' },
    });
  });

  it('không có task nào được giao thì không ghi lịch sử', async () => {
    prisma.taskAssignee.findMany.mockResolvedValue([]);
    await service.removeMember(owner, 1, 20);
    expect(prisma.taskAssignee.deleteMany).not.toHaveBeenCalled();
    expect(activity.log).not.toHaveBeenCalled();
  });

  it('leader khác không có quyền; không thể xóa người tạo dự án', async () => {
    await expect(service.removeMember(otherLeader, 1, 20)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeMember(owner, 1, 10)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.taskAssignee.deleteMany).not.toHaveBeenCalled();
  });
});

describe('ProjectsService - bộ trạng thái mặc định và nhóm phụ trách', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let service: ProjectsService;
  const row = (id: number, teamId: number | null = null) => ({ id, name: 'Dự án mới', description: null, startDate: null, endDate: null, createdById: 10, teamId, createdAt: new Date(), createdBy: {}, team: null, members: [], slackWebhookUrl: null });

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.project.findUniqueOrThrow.mockResolvedValue({ startDate: null, endDate: null });
    prisma.project.create.mockImplementation(({ data }: { data: { teamId: number | null } }) => Promise.resolve(row(50, data.teamId)));
    prisma.project.update.mockImplementation(({ data }: { data: { teamId?: number | null } }) => Promise.resolve(row(1, data.teamId ?? null)));
    prisma.projectStatus.createMany.mockResolvedValue({ count: 11 });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
    prisma.task.groupBy.mockResolvedValue([]);
    prisma.projectStatus.findMany.mockResolvedValue([]);
    prisma.team.findFirst.mockResolvedValue({ members: [{ userId: 20 }, { userId: 21 }] });
    prisma.projectMember.findMany.mockResolvedValue([{ userId: 20 }]);
    prisma.projectMember.createMany.mockResolvedValue({ count: 1 });
    const p = asPrisma(prisma);
    service = new ProjectsService(p, new ProjectAccessService(p), { notify } as unknown as NotificationsService, {} as ActivityService, {} as AttachmentCleanupService, {} as SlackService);
  });

  it('dự án mới tự có hai bộ trạng thái mặc định (5 công việc + 6 Bug)', async () => {
    prisma.user.count.mockResolvedValue(1);
    await service.create(owner, { name: 'Dự án mới' });
    const data = (callArg(prisma.projectStatus.createMany) as { data: { scope: string; projectId: number }[] }).data;
    expect(data.filter((s) => s.scope === 'task')).toHaveLength(5);
    expect(data.filter((s) => s.scope === 'bug')).toHaveLength(6);
    expect(data.every((s) => s.projectId === 50)).toBe(true);
  });

  it('tạo dự án thuộc nhóm: mọi thành viên của nhóm vào dự án', async () => {
    prisma.user.count.mockResolvedValue(3);
    await service.create(owner, { name: 'Dự án mới', teamId: 3 });
    const members = (callArg(prisma.project.create) as { data: { members: { create: { userId: number }[] } } }).data.members.create.map((m) => m.userId).sort();
    expect(members).toEqual([10, 20, 21]);
    expect(callArg(prisma.project.create)).toMatchObject({ data: { teamId: 3 } });
  });

  it('đổi nhóm: chỉ thêm người chưa có vào dự án (không gỡ ai) và báo cho họ', async () => {
    prisma.user.count.mockResolvedValue(1);
    await service.update(owner, 1, { teamId: 3 });
    expect(callArg(prisma.projectMember.createMany)).toMatchObject({ data: [{ projectId: 1, userId: 21 }], skipDuplicates: true });
    expect((callArg(notify) as { userId: number }[]).map((n) => n.userId)).toEqual([21]);
  });

  it('nhóm mà người dùng không thấy thì bị từ chối; teamId = null để gỡ nhóm', async () => {
    prisma.team.findFirst.mockResolvedValue(null);
    await expect(service.update(owner, 1, { teamId: 99 })).rejects.toBeInstanceOf(BadRequestException);
    await service.update(owner, 1, { teamId: null });
    expect(callArg(prisma.project.update)).toMatchObject({ data: { teamId: null } });
  });
});
