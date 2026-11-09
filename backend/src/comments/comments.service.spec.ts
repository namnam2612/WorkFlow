import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Task } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../test-utils';
import { CommentsService } from './comments.service';

const PROJECT = { id: 1, name: 'Dự án', createdById: 10 };
const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const admin: AuthUser = { id: 1, email: 'a@x.vn', name: 'Admin', role: 'admin' };
const alice: AuthUser = { id: 20, email: 'a1@x.vn', name: 'Alice', role: 'member' };
const bob: AuthUser = { id: 21, email: 'b@x.vn', name: 'Bob', role: 'member' };
const outsider: AuthUser = { id: 30, email: 'c@x.vn', name: 'Người ngoài', role: 'member' };
const MEMBERS = new Set([10, 20, 21]);

/** Task giả; `assigneeIds` = những người được giao, `parentAssigneeIds` = người được giao của task cha */
const task = (overrides: Partial<Task> & { assigneeIds?: number[] } = {}, parentAssigneeIds: number[] = []) => {
  const { assigneeIds = [], ...rest } = overrides;
  return {
  id: 5,
  projectId: 1,
  parentId: null,
  title: 'Task',
  description: null,
  creatorId: 10,
  status: 'todo',
  priority: 'medium',
  deadline: null,
  estimatedHours: null,
  actualHours: null,
  position: 0,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignees: assigneeIds.map((userId) => ({ userId })),
  parent: rest.parentId ? { assignees: parentAssigneeIds.map((userId) => ({ userId })) } : null,
  ...rest,
  };
};

describe('CommentsService - quyền bình luận', () => {
  let prisma: PrismaMock;
  let service: CommentsService;
  let notify: jest.Mock;

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockImplementation(({ where }: { where: { projectId_userId: { userId: number } } }) =>
      Promise.resolve(MEMBERS.has(where.projectId_userId.userId) ? { projectId: 1, userId: where.projectId_userId.userId } : null),
    );
    prisma.comment.create.mockResolvedValue({ id: 1, content: 'x', user: { id: 20, name: 'Alice', avatarUrl: null } });
    const prismaService = asPrisma(prisma);
    service = new CommentsService(
      prismaService,
      new ProjectAccessService(prismaService),
      { log: jest.fn().mockResolvedValue({}) } as unknown as ActivityService,
      { notify } as unknown as NotificationsService,
      { taskChanged: jest.fn() } as unknown as RealtimeService,
    );
  });

  it('leader sở hữu và admin bình luận được mọi task', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ assigneeIds: [20] }));
    await expect(service.create(owner, 5, 'ok')).resolves.toBeDefined();
    await expect(service.create(admin, 5, 'ok')).resolves.toBeDefined();
  });

  it('người được giao bình luận được', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ assigneeIds: [20] }));
    await expect(service.create(alice, 5, 'ok')).resolves.toBeDefined();
  });

  it('member không được giao thì không bình luận được trên task lớn', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ assigneeIds: [20] }));
    await expect(service.create(bob, 5, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('người tạo công việc con bình luận được dù việc con chưa giao ai', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ id: 8, parentId: 5, creatorId: 20 }, [20]));
    await expect(service.create(alice, 8, 'ok')).resolves.toBeDefined();
  });

  it('người được giao task cha bình luận được trên công việc con do người khác tạo', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ id: 8, parentId: 5, creatorId: 10 }, [20]));
    await expect(service.create(alice, 8, 'ok')).resolves.toBeDefined();
  });

  it('member không liên quan đến công việc con thì bị chặn', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ id: 8, parentId: 5, creatorId: 10 }, [20]));
    await expect(service.create(bob, 8, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('người ngoài dự án bị chặn kể cả là người tạo', async () => {
    prisma.task.findUnique.mockResolvedValue(task({ id: 8, parentId: 5, creatorId: 30, assigneeIds: [30] }, [30]));
    await expect(service.create(outsider, 8, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('task giao cho nhiều người', () => {
    it('MỘT trong những người được giao đều bình luận được; người không có trong danh sách thì không', async () => {
      prisma.task.findUnique.mockResolvedValue(task({ assigneeIds: [20, 21] }));
      await expect(service.create(alice, 5, 'ok')).resolves.toBeDefined();
      await expect(service.create(bob, 5, 'ok')).resolves.toBeDefined();
      await expect(service.create(outsider, 5, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('bình luận báo cho TẤT CẢ người được giao, người tạo và leader (trừ người bình luận)', async () => {
      prisma.task.findUnique.mockResolvedValue(task({ assigneeIds: [20, 21], creatorId: 10 }));
      await service.create(alice, 5, 'xin chào');
      const recipients = (notify.mock.calls[0] as [{ userId: number }[]])[0].map((n) => n.userId).sort();
      expect(recipients).toEqual([10, 21]);
    });

    it('bất kỳ người được giao của task cha đều bình luận được việc con', async () => {
      prisma.task.findUnique.mockResolvedValue(task({ id: 8, parentId: 5, creatorId: 10 }, [20, 21]));
      await expect(service.create(bob, 8, 'ok')).resolves.toBeDefined();
    });
  });

  it('404 khi task không tồn tại', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.create(owner, 404, 'ok')).rejects.toBeInstanceOf(NotFoundException);
  });
});
