import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Sprint } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { SprintsService } from './sprints.service';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'Member', role: 'member' };
const PROJECT = { id: 1, name: 'A', createdById: 10 };
const NOW = new Date('2026-11-10T03:00:00Z');

const sprint = (over: Partial<Sprint> = {}): Sprint => ({
  id: 5,
  projectId: 1,
  name: 'Sprint 1',
  goal: null,
  startDate: null,
  endDate: null,
  status: 'planned',
  committedPoints: null,
  completedPoints: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  ...over,
});

describe('SprintsService', () => {
  let prisma: PrismaMock;
  let activity: { log: jest.Mock };
  let service: SprintsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    activity = { log: jest.fn().mockResolvedValue({}) };
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.sprint.findUnique.mockResolvedValue(sprint());
    prisma.sprint.findFirst.mockResolvedValue(null);
    prisma.sprint.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...sprint(), ...data }));
    prisma.task.aggregate.mockResolvedValue({ _sum: { storyPoints: 13 } });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    const p = asPrisma(prisma);
    service = new SprintsService(p, new ProjectAccessService(p), activity as unknown as ActivityService);
  });

  describe('quyền', () => {
    it('member xem được nhưng không tạo/sửa/xóa/bắt đầu/kết thúc/xếp việc', async () => {
      prisma.sprint.findMany.mockResolvedValue([]);
      await expect(service.list(member, 1)).resolves.toEqual([]);
      await expect(service.create(member, 1, { name: 'S' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.update(member, 5, { name: 'S' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(member, 5)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.start(member, 5)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.complete(member, 5, {})).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.moveTasks(member, 1, 5, [1])).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('người ngoài dự án không xem được', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(service.list({ ...member, id: 99 }, 1)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.backlog({ ...member, id: 99 }, 1, false)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sprint không tồn tại => 404', async () => {
      prisma.sprint.findUnique.mockResolvedValue(null);
      await expect(service.start(owner, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create/update/remove', () => {
    it('ngày kết thúc phải sau ngày bắt đầu', async () => {
      await expect(service.create(owner, 1, { name: 'S', startDate: '2026-11-10T00:00:00Z', endDate: '2026-11-01T00:00:00Z' })).rejects.toBeInstanceOf(BadRequestException);
      prisma.sprint.create.mockResolvedValue(sprint());
      await expect(service.create(owner, 1, { name: 'S', startDate: '2026-11-01T00:00:00Z', endDate: '2026-11-10T00:00:00Z' })).resolves.toBeDefined();
    });

    it('sprint đã kết thúc không sửa được; chỉ xóa được sprint chưa bắt đầu', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint({ status: 'completed' }));
      await expect(service.update(owner, 5, { name: 'X' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.remove(owner, 5)).rejects.toBeInstanceOf(BadRequestException);
      prisma.sprint.findUnique.mockResolvedValue(sprint({ status: 'active' }));
      await expect(service.remove(owner, 5)).rejects.toBeInstanceOf(BadRequestException);
      prisma.sprint.findUnique.mockResolvedValue(sprint());
      prisma.sprint.delete.mockResolvedValue({});
      await expect(service.remove(owner, 5)).resolves.toBeUndefined();
    });
  });

  describe('start', () => {
    it('ghi mức cam kết = tổng Story Point lúc bắt đầu, mặc định kéo dài 14 ngày', async () => {
      const result = await service.start(owner, 5, NOW);
      expect(callArg(prisma.sprint.update)).toMatchObject({ data: { status: 'active', committedPoints: 13, startedAt: NOW } });
      expect(result.startDate?.toISOString()).toBe(NOW.toISOString());
      expect(result.endDate?.toISOString()).toBe('2026-11-24T03:00:00.000Z');
    });

    it('chỉ một sprint đang chạy mỗi dự án', async () => {
      prisma.sprint.findFirst.mockResolvedValue({ name: 'Sprint 0' });
      await expect(service.start(owner, 5, NOW)).rejects.toThrow(/Sprint 0/);
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('chỉ bắt đầu được sprint ở trạng thái kế hoạch', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint({ status: 'active' }));
      await expect(service.start(owner, 5, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('complete', () => {
    beforeEach(() => {
      prisma.sprint.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(where.id === 5 ? sprint({ status: 'active' }) : where.id === 6 ? sprint({ id: 6, name: 'Sprint 2' }) : where.id === 7 ? sprint({ id: 7, projectId: 2 }) : null),
      );
      prisma.task.aggregate.mockResolvedValue({ _sum: { storyPoints: 8 } });
      prisma.task.findMany.mockResolvedValue([{ id: 31 }, { id: 32 }]);
    });

    it('ghi điểm đã xong (velocity) và trả việc chưa xong về backlog mặc định', async () => {
      await service.complete(owner, 5, {}, NOW);
      expect(callArg(prisma.task.updateMany)).toMatchObject({ where: { id: { in: [31, 32] } }, data: { sprintId: null } });
      expect(callArg(prisma.sprint.update)).toMatchObject({ data: { status: 'completed', completedAt: NOW, completedPoints: 8 } });
    });

    it('chuyển việc chưa xong sang sprint kế tiếp nếu chọn', async () => {
      await service.complete(owner, 5, { moveIncompleteTo: 6 }, NOW);
      expect(callArg(prisma.task.updateMany)).toMatchObject({ data: { sprintId: 6 } });
    });

    it('sprint đích sai (khác dự án, chính nó, không tồn tại) bị từ chối', async () => {
      await expect(service.complete(owner, 5, { moveIncompleteTo: 7 }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.complete(owner, 5, { moveIncompleteTo: 5 }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.complete(owner, 5, { moveIncompleteTo: 99 }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('chỉ kết thúc được sprint đang chạy', async () => {
      prisma.sprint.findUnique.mockResolvedValue(sprint());
      await expect(service.complete(owner, 5, {}, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('moveTasks', () => {
    it('đưa việc vào sprint, ghi lịch sử cho việc thật sự đổi', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 1, sprintId: null },
        { id: 2, sprintId: 5 },
      ]);
      prisma.task.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.moveTasks(owner, 1, 5, [1, 2])).resolves.toEqual({ moved: 1 });
      expect(callArg(prisma.task.updateMany)).toMatchObject({ where: { id: { in: [1] } }, data: { sprintId: 5 } });
      expect(activity.log).toHaveBeenCalledTimes(1);
    });

    it('từ chối việc không hợp lệ (khác dự án / epic / công việc con) và sprint đã kết thúc hoặc của dự án khác', async () => {
      prisma.task.findMany.mockResolvedValue([{ id: 1, sprintId: null }]);
      await expect(service.moveTasks(owner, 1, 5, [1, 2])).rejects.toBeInstanceOf(BadRequestException);
      prisma.sprint.findUnique.mockResolvedValue(sprint({ status: 'completed' }));
      await expect(service.moveTasks(owner, 1, 5, [1])).rejects.toBeInstanceOf(BadRequestException);
      prisma.sprint.findUnique.mockResolvedValue(sprint({ projectId: 2 }));
      await expect(service.moveTasks(owner, 1, 5, [1])).rejects.toBeInstanceOf(NotFoundException);
    });

    it('về backlog khi sprintId = null', async () => {
      prisma.task.findMany.mockResolvedValue([{ id: 1, sprintId: 5 }]);
      await service.moveTasks(owner, 1, null, [1]);
      expect(callArg(prisma.task.updateMany)).toMatchObject({ data: { sprintId: null } });
    });
  });

  describe('velocity', () => {
    it('cũ → mới, kèm trung bình điểm hoàn thành của 3 sprint gần nhất', async () => {
      const done = (id: number, committed: number, completed: number, day: number) => sprint({ id, name: `S${id}`, status: 'completed', committedPoints: committed, completedPoints: completed, completedAt: new Date(2026, 10, day) });
      prisma.sprint.findMany.mockResolvedValue([done(4, 20, 18, 28), done(3, 20, 12, 21), done(2, 18, 15, 14), done(1, 15, 5, 7)]); // mới → cũ (đúng thứ tự truy vấn)
      const result = await service.velocity(member, 1, 8);
      expect(result.items.map((i) => i.id)).toEqual([1, 2, 3, 4]);
      expect(result.average).toBe(15); // (15 + 12 + 18) / 3
    });
  });
});
