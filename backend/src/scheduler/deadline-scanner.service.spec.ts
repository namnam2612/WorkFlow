import { NotificationsService } from '../notifications/notifications.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../test-utils';
import { DeadlineScannerService } from './deadline-scanner.service';

const NOW = new Date('2026-11-10T12:00:00Z');
const task = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  title: 'Làm chung',
  deadline: new Date('2026-11-10T20:00:00Z'), // còn 8 giờ
  assignees: [{ userId: 20 }, { userId: 21 }, { userId: 22 }],
  project: { createdById: 10 },
  ...overrides,
});

describe('DeadlineScannerService - nhiều người được giao', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let service: DeadlineScannerService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.notification.findFirst.mockResolvedValue(null);
    notify = jest.fn().mockResolvedValue(undefined);
    service = new DeadlineScannerService(asPrisma(prisma), { notify } as unknown as NotificationsService);
  });

  const recipients = () => (notify.mock.calls as [{ userId: number; type: string }[]][]).flatMap((c) => c[0]).map((n) => n.userId).sort((a, b) => a - b);

  it('sắp đến hạn: báo cho TẤT CẢ người được giao (không báo leader)', async () => {
    prisma.task.findMany.mockResolvedValue([task()]);
    const result = await service.scan(NOW);
    expect(recipients()).toEqual([20, 21, 22]);
    expect(result).toEqual({ dueSoon: 3, overdue: 0 });
  });

  it('quá hạn: báo mọi người được giao và thêm leader dự án', async () => {
    prisma.task.findMany.mockResolvedValue([task({ deadline: new Date('2026-11-09T00:00:00Z') })]);
    const result = await service.scan(NOW);
    expect(recipients()).toEqual([10, 20, 21, 22]);
    expect(result).toEqual({ dueSoon: 0, overdue: 4 });
  });

  it('không báo trùng người đã có thông báo cho mốc này', async () => {
    prisma.task.findMany.mockResolvedValue([task()]);
    prisma.notification.findFirst.mockImplementation(({ where }: { where: { userId: number } }) => Promise.resolve(where.userId === 21 ? { id: 1 } : null));
    await service.scan(NOW);
    expect(recipients()).toEqual([20, 22]);
  });

  it('task chưa giao ai: không báo ai khi sắp hạn', async () => {
    prisma.task.findMany.mockResolvedValue([task({ assignees: [] })]);
    await service.scan(NOW);
    expect(notify).not.toHaveBeenCalled();
  });
});
