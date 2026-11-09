import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock } from '../test-utils';
import { StatusesService } from '../statuses/statuses.service';
import { bucketOf, myWorkWindow, startOfVnDay } from './my-work';
import { TasksService } from './tasks.service';
import type { ActivityService } from '../activity/activity.service';
import type { AttachmentCleanupService } from '../attachments/attachment-cleanup.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { RealtimeService } from '../realtime/realtime.service';

// 2026-11-10 02:00 giờ VN = 2026-11-09 19:00 UTC: UTC vẫn là ngày 9 nhưng ở VN đã sang ngày 10
const NOW = new Date('2026-11-09T19:00:00Z');
const W = myWorkWindow(NOW);

describe('ngày làm việc theo giờ Việt Nam', () => {
  it('00:00 VN của ngày hiện tại (không lệch theo UTC)', () => {
    expect(startOfVnDay(NOW).toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(startOfVnDay(new Date('2026-11-10T16:59:59Z')).toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(startOfVnDay(new Date('2026-11-10T17:00:00Z')).toISOString()).toBe('2026-11-10T17:00:00.000Z');
  });
});

describe('bucketOf', () => {
  const at = (iso: string | null) => (iso === null ? null : new Date(iso));
  it('quá hạn: deadline trước 00:00 hôm nay', () => {
    expect(bucketOf({ deadline: at('2026-11-09T16:59:00Z'), category: 'todo' }, W)).toBe('overdue');
    expect(bucketOf({ deadline: at('2026-11-01T00:00:00Z'), category: 'in_progress' }, W)).toBe('overdue');
  });
  it('hạn hôm nay: trong [00:00, 24:00) giờ VN, kể cả khi deadline đã qua giờ', () => {
    expect(bucketOf({ deadline: at('2026-11-09T17:00:00Z'), category: 'todo' }, W)).toBe('dueToday');
    expect(bucketOf({ deadline: at('2026-11-10T16:59:00Z'), category: 'in_progress' }, W)).toBe('dueToday');
  });
  it('đang làm không có deadline gần => nhóm đang làm; chưa làm không có deadline => không hiện', () => {
    expect(bucketOf({ deadline: null, category: 'in_progress' }, W)).toBe('inProgress');
    expect(bucketOf({ deadline: at('2027-01-01T00:00:00Z'), category: 'in_progress' }, W)).toBe('inProgress');
    expect(bucketOf({ deadline: null, category: 'todo' }, W)).toBeNull();
    expect(bucketOf({ deadline: at('2027-01-01T00:00:00Z'), category: 'todo' }, W)).toBeNull();
  });
  it('sắp tới: trong 7 ngày kể từ ngày mai', () => {
    expect(bucketOf({ deadline: at('2026-11-12T00:00:00Z'), category: 'todo' }, W)).toBe('upcoming');
    expect(bucketOf({ deadline: at('2026-11-17T16:59:00Z'), category: 'todo' }, W)).toBe('upcoming');
    expect(bucketOf({ deadline: at('2026-11-17T17:00:00Z'), category: 'todo' }, W)).toBeNull();
  });
  it('task đã xong không bao giờ hiện', () => {
    expect(bucketOf({ deadline: at('2026-11-01T00:00:00Z'), category: 'done' }, W)).toBeNull();
  });
});

describe('TasksService.myWork', () => {
  const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };
  const row = (id: number, deadline: string | null, category: 'todo' | 'in_progress') => ({
    id,
    title: `T${id}`,
    deadline: deadline ? new Date(deadline) : null,
    status: { id: 1, name: 'x', color: '#000000', category, scope: 'task' },
    assignees: [],
    subtasks: [],
    _count: { comments: 0, attachments: 0 },
  });

  it('chỉ lấy việc giao cho mình, không epic, chưa xong, trong dự án mình xem được; chia nhóm và đếm việc xong hôm nay', async () => {
    const prisma = createPrismaMock();
    prisma.task.findMany.mockResolvedValue([
      row(1, '2026-11-01T00:00:00Z', 'todo'),
      row(2, '2026-11-10T03:00:00Z', 'in_progress'),
      row(3, null, 'in_progress'),
      row(4, '2026-11-12T00:00:00Z', 'todo'),
      row(5, null, 'todo'),
    ]);
    prisma.task.count.mockResolvedValue(3);
    const p = asPrisma(prisma);
    const service = new TasksService(p, new ProjectAccessService(p), {} as ActivityService, {} as NotificationsService, {} as RealtimeService, {} as AttachmentCleanupService, {} as StatusesService);
    const result = await service.myWork(member, NOW);
    expect(result.overdue.map((t) => t.id)).toEqual([1]);
    expect(result.dueToday.map((t) => t.id)).toEqual([2]);
    expect(result.inProgress.map((t) => t.id)).toEqual([3]);
    expect(result.upcoming.map((t) => t.id)).toEqual([4]);
    expect(result.doneToday).toBe(3);
    expect(result.date).toBe('2026-11-09T17:00:00.000Z');
    expect(callArg(prisma.task.findMany)).toMatchObject({
      where: { assignees: { some: { userId: 20 } }, type: { not: 'epic' }, status: { category: { not: 'done' } } },
    });
  });
});
