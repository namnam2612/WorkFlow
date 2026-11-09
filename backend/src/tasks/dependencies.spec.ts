import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { wouldCreateCycle } from './dependencies';
import { TaskDependenciesService } from './task-dependencies.service';

describe('wouldCreateCycle', () => {
  const edges = [
    { taskId: 2, dependsOnId: 1 }, // 2 chờ 1
    { taskId: 3, dependsOnId: 2 }, // 3 chờ 2
  ];
  it('phát hiện vòng trực tiếp, gián tiếp và tự phụ thuộc', () => {
    expect(wouldCreateCycle(edges, 1, 3)).toBe(true); // 1 chờ 3, mà 3 chờ 2 chờ 1
    expect(wouldCreateCycle(edges, 1, 2)).toBe(true);
    expect(wouldCreateCycle(edges, 4, 4)).toBe(true);
  });
  it('phụ thuộc hợp lệ (không tạo vòng) và đồ thị rỗng', () => {
    expect(wouldCreateCycle(edges, 4, 1)).toBe(false);
    expect(wouldCreateCycle(edges, 3, 1)).toBe(false); // thêm đường tắt, vẫn là DAG
    expect(wouldCreateCycle([], 1, 2)).toBe(false);
  });
  it('không lặp vô hạn khi đồ thị có nhiều nhánh', () => {
    const diamond = [
      { taskId: 2, dependsOnId: 1 },
      { taskId: 3, dependsOnId: 1 },
      { taskId: 4, dependsOnId: 2 },
      { taskId: 4, dependsOnId: 3 },
    ];
    expect(wouldCreateCycle(diamond, 5, 4)).toBe(false);
    expect(wouldCreateCycle(diamond, 1, 4)).toBe(true);
  });
});

describe('TaskDependenciesService', () => {
  const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'L', role: 'leader' };
  const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };
  let prisma: PrismaMock & { taskDependency: Record<'findMany' | 'findUnique' | 'create' | 'delete', jest.Mock> };
  let activity: { log: jest.Mock };
  let service: TaskDependenciesService;
  const task = (id: number, over: object = {}) => ({ id, title: `T${id}`, projectId: 1, type: 'task', ...over });

  beforeEach(() => {
    const base = createPrismaMock();
    prisma = Object.assign(base, { taskDependency: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() } });
    activity = { log: jest.fn().mockResolvedValue({}) };
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.task.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(task(where.id)));
    prisma.taskDependency.findMany.mockResolvedValue([]);
    prisma.taskDependency.create.mockResolvedValue({});
    const p = asPrisma(prisma);
    service = new TaskDependenciesService(p, new ProjectAccessService(p), activity as unknown as ActivityService, { taskChanged: jest.fn() } as unknown as RealtimeService);
  });

  it('leader tạo phụ thuộc và ghi lịch sử; member không được', async () => {
    await service.add(owner, 3, 2);
    expect(callArg(prisma.taskDependency.create)).toMatchObject({ data: { taskId: 3, dependsOnId: 2 } });
    expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'dependency_changed', detail: { added: { id: 2, title: 'T2' } } }));
    await expect(service.add(member, 3, 2)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('từ chối: tự phụ thuộc, khác dự án, Epic, trùng, tạo vòng', async () => {
    await expect(service.add(owner, 3, 3)).rejects.toBeInstanceOf(BadRequestException);
    prisma.task.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(task(where.id, where.id === 9 ? { projectId: 2 } : where.id === 8 ? { type: 'epic' } : {})));
    await expect(service.add(owner, 3, 9)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.add(owner, 3, 8)).rejects.toBeInstanceOf(BadRequestException);
    prisma.taskDependency.findMany.mockResolvedValue([{ taskId: 3, dependsOnId: 2 }]);
    await expect(service.add(owner, 3, 2)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.add(owner, 2, 3)).rejects.toThrow(/vòng/);
    expect(prisma.taskDependency.create).not.toHaveBeenCalled();
  });

  it('gỡ phụ thuộc: cần quyền quản lý và phụ thuộc phải tồn tại', async () => {
    prisma.taskDependency.findUnique.mockResolvedValue(null);
    await expect(service.remove(owner, 3, 2)).rejects.toBeInstanceOf(NotFoundException);
    prisma.taskDependency.findUnique.mockResolvedValue({ taskId: 3, dependsOnId: 2 });
    prisma.taskDependency.delete.mockResolvedValue({});
    await service.remove(owner, 3, 2);
    expect(prisma.taskDependency.delete).toHaveBeenCalled();
    await expect(service.remove(member, 3, 2)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
