import { toNumberList } from '../common/utils/transforms';
import { asPrisma, callArg, createPrismaMock } from '../test-utils';
import { assigneeStats } from './assignee-stats';

const NOW = new Date('2026-11-10T00:00:00Z');
const past = new Date('2026-11-01T00:00:00Z');
const future = new Date('2026-12-01T00:00:00Z');

describe('assigneeStats (thống kê theo từng người được giao)', () => {
  it('task giao cho nhiều người được tính cho TỪNG người', async () => {
    const prisma = createPrismaMock();
    prisma.taskAssignee.findMany.mockResolvedValue([
      { userId: 20, task: { status: { category: 'in_progress' }, deadline: future } },
      { userId: 21, task: { status: { category: 'in_progress' }, deadline: future } }, // cùng một task giao cho 20 và 21
      { userId: 20, task: { status: { category: 'done' }, deadline: past } },
    ]);
    const stats = await assigneeStats(asPrisma(prisma), { task: { parentId: null } }, NOW);
    expect(stats.get(20)?.counts).toEqual({ todo: 0, in_progress: 1, done: 1 });
    expect(stats.get(21)?.counts.in_progress).toBe(1);
    expect(stats.has(22)).toBe(false);
  });

  it('quá hạn = chưa xong và deadline đã qua; task đã xong hoặc không có deadline thì không tính', async () => {
    const prisma = createPrismaMock();
    prisma.taskAssignee.findMany.mockResolvedValue([
      { userId: 20, task: { status: { category: 'todo' }, deadline: past } },
      { userId: 20, task: { status: { category: 'in_progress' }, deadline: past } },
      { userId: 20, task: { status: { category: 'done' }, deadline: past } },
      { userId: 20, task: { status: { category: 'todo' }, deadline: null } },
      { userId: 20, task: { status: { category: 'todo' }, deadline: future } },
    ]);
    expect((await assigneeStats(asPrisma(prisma), {}, NOW)).get(20)?.overdue).toBe(2);
  });

  it('truyền nguyên điều kiện lọc xuống bảng nối', async () => {
    const prisma = createPrismaMock();
    prisma.taskAssignee.findMany.mockResolvedValue([]);
    await assigneeStats(asPrisma(prisma), { userId: { in: [1, 2] }, task: { parentId: null } });
    expect(callArg(prisma.taskAssignee.findMany)).toMatchObject({ where: { userId: { in: [1, 2] }, task: { parentId: null } } });
  });
});

describe('toNumberList (bộ lọc assigneeIds trên query string)', () => {
  const run = (value: unknown) => toNumberList({ value });
  it('nhận "1,2,3", mảng chuỗi (?k=1&k=2) và một giá trị đơn', () => {
    expect(run('1,2,3')).toEqual([1, 2, 3]);
    expect(run(['4', '5'])).toEqual([4, 5]);
    expect(run('7')).toEqual([7]);
  });
  it('rỗng/không có => undefined (không lọc)', () => {
    expect(run('')).toBeUndefined();
    expect(run(undefined)).toBeUndefined();
  });
  it('giá trị không phải số trở thành NaN để validator từ chối', () => {
    expect(run('1,abc')).toEqual([1, Number.NaN]);
  });
});
