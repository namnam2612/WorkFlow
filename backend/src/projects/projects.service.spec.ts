import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AttachmentCleanupService } from '../attachments/attachment-cleanup.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
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
