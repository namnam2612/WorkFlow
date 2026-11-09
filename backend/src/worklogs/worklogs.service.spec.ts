import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { parseVnDate, WorkLogsService } from './worklogs.service';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const assignee: AuthUser = { id: 20, email: 'a@x.vn', name: 'A', role: 'member' };
const other: AuthUser = { id: 21, email: 'b@x.vn', name: 'B', role: 'member' };
const PROJECT = { id: 1, name: 'P', createdById: 10 };
// 2026-11-10 10:00 giờ VN
const NOW = new Date('2026-11-10T03:00:00Z');

describe('WorkLogsService', () => {
  let prisma: PrismaMock;
  let activity: { log: jest.Mock };
  let service: WorkLogsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    activity = { log: jest.fn().mockResolvedValue({}) };
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.task.findUnique.mockResolvedValue({ id: 5, projectId: 1, type: 'task', assignees: [{ userId: 20 }] });
    prisma.task.update.mockResolvedValue({});
    prisma.workLog.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 1, ...data }));
    prisma.workLog.aggregate.mockResolvedValue({ _sum: { minutes: 150 } });
    const p = asPrisma(prisma);
    service = new WorkLogsService(p, new ProjectAccessService(p), activity as unknown as ActivityService);
  });

  describe('add', () => {
    it('người được giao ghi được; giờ thực tế của task = tổng phút / 60 (làm tròn 2 số lẻ)', async () => {
      await service.add(assignee, 5, { minutes: 90, note: 'Làm form' }, NOW);
      expect(callArg(prisma.workLog.create)).toMatchObject({ data: { taskId: 5, userId: 20, minutes: 90, workedOn: new Date('2026-11-09T17:00:00Z'), note: 'Làm form' } });
      expect(callArg(prisma.task.update)).toMatchObject({ where: { id: 5 }, data: { actualHours: 2.5 } });
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'worklog_added' }), prisma);
    });

    it('người không được giao thì bị chặn, leader của dự án thì được', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 21 });
      await expect(service.add(other, 5, { minutes: 30 }, NOW)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.add(owner, 5, { minutes: 30 }, NOW)).resolves.toBeDefined();
    });

    it('không ghi cho Epic, ngày tương lai hoặc ngày không hợp lệ; thành viên chỉ ghi bù tối đa 60 ngày', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 5, projectId: 1, type: 'epic', assignees: [{ userId: 20 }] });
      await expect(service.add(assignee, 5, { minutes: 30 }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.add(assignee, 5, { minutes: 30, workedOn: '2026-11-11' }, NOW)).rejects.toThrow(/tương lai/);
      await expect(service.add(assignee, 5, { minutes: 30, workedOn: '2026-13-45' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.add(assignee, 5, { minutes: 30, workedOn: '2026-08-01' }, NOW)).rejects.toThrow(/60 ngày/);
      await expect(service.add(owner, 5, { minutes: 30, workedOn: '2026-08-01' }, NOW)).resolves.toBeDefined();
    });

    it('ngày hôm nay tính theo giờ VN (không lệch theo UTC)', async () => {
      // 02:00 VN ngày 11/11 = 19:00 UTC ngày 10/11
      await service.add(assignee, 5, { minutes: 10 }, new Date('2026-11-10T19:00:00Z'));
      expect(callArg(prisma.workLog.create)).toMatchObject({ data: { workedOn: new Date('2026-11-10T17:00:00Z') } });
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.workLog.findUnique.mockResolvedValue({ id: 3, taskId: 5, userId: 20, minutes: 60, workedOn: new Date(), task: { projectId: 1 } });
      prisma.workLog.delete.mockResolvedValue({});
    });

    it('chủ bản ghi hoặc leader xóa được, người khác thì không; tính lại giờ thực tế', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 21 });
      await expect(service.remove(other, 3)).rejects.toBeInstanceOf(ForbiddenException);
      await service.remove(assignee, 3);
      await service.remove(owner, 3);
      expect(prisma.workLog.delete).toHaveBeenCalledTimes(2);
      expect(callArg(prisma.task.update)).toMatchObject({ data: { actualHours: 2.5 } });
    });

    it('xóa hết bản ghi thì giờ thực tế về null', async () => {
      prisma.workLog.aggregate.mockResolvedValue({ _sum: { minutes: null } });
      await service.remove(assignee, 3);
      expect(callArg(prisma.task.update)).toMatchObject({ data: { actualHours: null } });
    });

    it('không tồn tại => 404', async () => {
      prisma.workLog.findUnique.mockResolvedValue(null);
      await expect(service.remove(owner, 9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('timesheet', () => {
    const logs = [
      { minutes: 60, workedOn: new Date('2026-11-08T17:00:00Z'), taskId: 5, user: { id: 20, name: 'A', avatarUrl: null } },
      { minutes: 120, workedOn: new Date('2026-11-09T17:00:00Z'), taskId: 6, user: { id: 20, name: 'A', avatarUrl: null } },
      { minutes: 30, workedOn: new Date('2026-11-09T17:00:00Z'), taskId: 5, user: { id: 21, name: 'B', avatarUrl: null } },
    ];

    it('leader xem tất cả: tổng theo người và theo ngày, sắp theo thời gian giảm dần', async () => {
      prisma.workLog.findMany.mockResolvedValue(logs);
      const result = await service.timesheet(owner, 1, undefined, undefined, NOW);
      expect(result.totalMinutes).toBe(210);
      expect(result.byUser.map((u) => [u.user.id, u.minutes, u.taskCount])).toEqual([
        [20, 180, 2],
        [21, 30, 1],
      ]);
      expect(result.byDay.map((d) => d.minutes)).toEqual([60, 150]);
      expect(callArg(prisma.workLog.findMany)).toMatchObject({ where: { task: { projectId: 1 } } });
    });

    it('member chỉ thấy phần của mình', async () => {
      prisma.workLog.findMany.mockResolvedValue([]);
      await service.timesheet(assignee, 1, undefined, undefined, NOW);
      expect(callArg(prisma.workLog.findMany)).toMatchObject({ where: { userId: 20 } });
    });

    it('khoảng ngày sai hoặc quá dài bị từ chối', async () => {
      await expect(service.timesheet(owner, 1, '2026-11-10', '2026-11-01', NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.timesheet(owner, 1, '2026-01-01', '2026-11-01', NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('parseVnDate', () => {
  it('00:00 VN dạng UTC; ngày sai => null', () => {
    expect(parseVnDate('2026-11-10')?.toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(parseVnDate('2026-02-30')).toBeNull();
    expect(parseVnDate('abc')).toBeNull();
  });
});
