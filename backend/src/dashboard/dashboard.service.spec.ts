import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { DashboardQueryDto } from './dashboard-query.dto';
import { DashboardService } from './dashboard.service';

const leader: AuthUser = { id: 10, email: 'l@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'Cường', role: 'member' };
const query = (over: Partial<DashboardQueryDto> = {}) => Object.assign(new DashboardQueryDto(), over);

describe('DashboardService - nhiều người được giao', () => {
  let prisma: PrismaMock;
  let service: DashboardService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.project.findMany.mockResolvedValue([{ id: 1, name: 'Dự án A' }]);
    prisma.task.groupBy.mockResolvedValue([]);
    prisma.projectStatus.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    prisma.user.findMany.mockResolvedValue([
      { id: 20, name: 'Cường' },
      { id: 21, name: 'Dung' },
    ]);
    // Một task quá hạn giao cho CẢ Cường và Dung + một task riêng của Cường
    prisma.taskAssignee.findMany.mockResolvedValue([
      { userId: 20, task: { status: { category: 'in_progress' }, deadline: new Date('2020-01-01') } },
      { userId: 21, task: { status: { category: 'in_progress' }, deadline: new Date('2020-01-01') } },
      { userId: 20, task: { status: { category: 'todo' }, deadline: null } },
    ]);
    const prismaService = asPrisma(prisma);
    service = new DashboardService(prismaService, new ProjectAccessService(prismaService));
  });

  it('workload: task nhiều người được tính cho từng người, kể cả số quá hạn', async () => {
    const result = await service.get(leader, query());
    const row = (id: number) => result.workload.find((r) => r.userId === id);
    expect(row(20)).toMatchObject({ name: 'Cường', in_progress: 1, todo: 1, overdue: 1 });
    expect(row(21)).toMatchObject({ name: 'Dung', in_progress: 1, todo: 0, overdue: 1 });
  });

  it('"của tôi" (member luôn bị ép): lọc task có tôi trong danh sách người được giao', async () => {
    await service.get(member, query());
    const where = (callArg(prisma.task.groupBy) as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ assignees: { some: { userId: 20 } } });
  });

  it('leader mặc định xem cả nhóm (không lọc theo người)', async () => {
    await service.get(leader, query());
    const where = (callArg(prisma.task.groupBy) as { where: Record<string, unknown> }).where;
    expect('assignees' in where).toBe(false);
  });
});
