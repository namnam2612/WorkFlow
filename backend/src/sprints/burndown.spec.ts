import { buildBurndown } from './burndown';

// Sprint 5 ngày: 10–14/11/2026 (giờ VN)
const START = new Date('2026-11-09T17:00:00Z'); // 00:00 10/11 VN
const END = new Date('2026-11-14T10:00:00Z'); // 17:00 14/11 VN
const at = (iso: string) => new Date(iso);

describe('buildBurndown', () => {
  const tasks = [
    { points: 5, completedAt: at('2026-11-11T03:00:00Z') }, // xong 11/11 (VN 10:00)
    { points: 3, completedAt: at('2026-11-12T20:00:00Z') }, // xong 13/11 VN (03:00)
    { points: 2, completedAt: null },
  ];

  it('đường lý tưởng giảm đều từ mức cam kết về 0 và còn lại = phạm vi − điểm đã xong đến hết ngày', () => {
    const result = buildBurndown({ startDate: START, endDate: END, committedPoints: 10, tasks, now: at('2026-11-13T05:00:00Z') });
    expect(result.unit).toBe('points');
    expect(result.points).toHaveLength(5);
    expect(result.points.map((p) => p.ideal)).toEqual([10, 7.5, 5, 2.5, 0]);
    // 10/11: 10, 11/11: 5 (xong 5đ), 12/11: 5, 13/11: 2 (xong thêm 3đ), 14/11: chưa tới
    expect(result.points.map((p) => p.remaining)).toEqual([10, 5, 5, 2, null]);
    expect(result.scope).toBe(10);
    expect(result.committed).toBe(10);
  });

  it('mốc ngày theo giờ Việt Nam: việc xong 23:30 VN vẫn tính vào đúng ngày đó', () => {
    const late = [{ points: 4, completedAt: at('2026-11-10T16:30:00Z') }]; // 23:30 VN ngày 10/11
    const r = buildBurndown({ startDate: START, endDate: END, committedPoints: 4, tasks: late, now: at('2026-11-14T00:00:00Z') });
    expect(r.points[0]?.remaining).toBe(0);
  });

  it('thêm việc giữa sprint: phạm vi lớn hơn mức cam kết, đường lý tưởng vẫn theo cam kết', () => {
    const r = buildBurndown({ startDate: START, endDate: END, committedPoints: 8, tasks, now: at('2026-11-10T01:00:00Z') });
    expect(r.committed).toBe(8);
    expect(r.scope).toBe(10);
    expect(r.points[0]).toMatchObject({ ideal: 8, remaining: 10 });
  });

  it('chưa ước lượng điểm nào thì đếm theo số việc', () => {
    const r = buildBurndown({
      startDate: START,
      endDate: END,
      committedPoints: 0,
      tasks: [
        { points: null, completedAt: at('2026-11-11T03:00:00Z') },
        { points: null, completedAt: null },
      ],
      now: at('2026-11-12T05:00:00Z'),
    });
    expect(r.unit).toBe('tasks');
    expect(r.scope).toBe(2);
    expect(r.committed).toBe(2);
    expect(r.points.map((p) => p.remaining)).toEqual([2, 1, 1, null, null]);
  });

  it('sprint một ngày và sprint rất dài được giới hạn số điểm', () => {
    expect(buildBurndown({ startDate: START, endDate: START, committedPoints: 3, tasks: [], now: START }).points).toHaveLength(1);
    const long = buildBurndown({ startDate: START, endDate: new Date('2030-01-01T00:00:00Z'), committedPoints: 3, tasks: [], now: START });
    expect(long.points.length).toBeLessThanOrEqual(120);
  });
});
