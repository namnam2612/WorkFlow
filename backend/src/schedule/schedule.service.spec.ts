import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { LeavesService } from '../leaves/leaves.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { ScheduleService } from './schedule.service';

const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };

describe('ScheduleService', () => {
  let prisma: PrismaMock & { taskDependency: { findMany: jest.Mock } };
  let leaves: { list: jest.Mock };
  let service: ScheduleService;

  beforeEach(() => {
    prisma = Object.assign(createPrismaMock(), { taskDependency: { findMany: jest.fn().mockResolvedValue([{ taskId: 2, dependsOnId: 1 }]) } });
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.sprint.findMany.mockResolvedValue([]);
    leaves = { list: jest.fn().mockResolvedValue([{ id: 1 }]) };
    const p = asPrisma(prisma);
    service = new ScheduleService(p, new ProjectAccessService(p), leaves as unknown as LeavesService);
  });

  it('lịch: chỉ việc trong dự án mình xem được, bỏ Epic, lọc theo khoảng ngày và "của tôi"', async () => {
    const result = await service.calendar(member, { from: '2026-11-01', to: '2026-11-30', mine: true });
    const where = (callArg(prisma.task.findMany) as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ type: { not: 'epic' }, assignees: { some: { userId: 20 } } });
    expect(where.project).toBeDefined();
    expect(result.from).toBe('2026-10-31T17:00:00.000Z');
    expect(result.to).toBe('2026-11-30T16:59:59.999Z'); // hết ngày 30/11 giờ VN
    expect(leaves.list).toHaveBeenCalledWith(member, { from: '2026-11-01', to: '2026-11-30', status: 'approved' });
    expect(result.leaves).toEqual([{ id: 1 }]);
  });

  it('từ chối khoảng quá dài, ngày sai, và dự án không thuộc về mình', async () => {
    await expect(service.calendar(member, { from: '2026-01-01', to: '2026-12-31' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.calendar(member, { from: '2026-11-30', to: '2026-11-01' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.calendar(member, { from: '2026-13-01', to: '2026-13-02' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(service.calendar(member, { from: '2026-11-01', to: '2026-11-30', projectId: 1 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gantt: cần là thành viên dự án; trả kèm phụ thuộc', async () => {
    const result = await service.gantt(member, 1);
    expect(result.dependencies).toEqual([{ taskId: 2, dependsOnId: 1 }]);
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(service.gantt(member, 1)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
