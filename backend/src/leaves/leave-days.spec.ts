import { leaveWorkingDaysIn, rangesOverlap, vnDayStartMs, workingDays } from './leave-days';

const d = (iso: string) => new Date(`${iso}T00:00:00+07:00`);

describe('ngày làm việc theo giờ Việt Nam', () => {
  it('chỉ lấy Thứ 2–Thứ 6, hai đầu đều tính', () => {
    // 09/11/2026 là Thứ Hai; 15/11 là Chủ nhật
    expect(workingDays(d('2026-11-09'), d('2026-11-15'))).toHaveLength(5);
    expect(workingDays(d('2026-11-09'), d('2026-11-09'))).toHaveLength(1);
    expect(workingDays(d('2026-11-14'), d('2026-11-15'))).toHaveLength(0); // Thứ Bảy + Chủ nhật
  });

  it('mốc 23:30 VN vẫn thuộc ngày hôm đó (không lệch theo UTC)', () => {
    expect(vnDayStartMs(new Date('2026-11-09T16:30:00Z'))).toBe(d('2026-11-09').getTime()); // 23:30 VN 09/11
    expect(vnDayStartMs(new Date('2026-11-09T17:30:00Z'))).toBe(d('2026-11-10').getTime()); // 00:30 VN 10/11
  });

  it('đơn nghỉ chỉ tính phần giao với khoảng đang xét và bỏ cuối tuần', () => {
    // nghỉ 12/11 (T5) → 18/11 (T4): T5, T6, T2, T3, T4 = 5 ngày làm việc
    expect(leaveWorkingDaysIn(d('2026-11-12'), d('2026-11-18'), d('2026-11-01'), d('2026-11-30'))).toBe(5);
    // chỉ xét 09–13/11: T5 + T6 = 2
    expect(leaveWorkingDaysIn(d('2026-11-12'), d('2026-11-18'), d('2026-11-09'), d('2026-11-13'))).toBe(2);
    // không giao
    expect(leaveWorkingDaysIn(d('2026-11-12'), d('2026-11-18'), d('2026-12-01'), d('2026-12-10'))).toBe(0);
  });

  it('rangesOverlap: chung một ngày ở biên cũng tính là trùng', () => {
    expect(rangesOverlap(d('2026-11-09'), d('2026-11-11'), d('2026-11-11'), d('2026-11-13'))).toBe(true);
    expect(rangesOverlap(d('2026-11-09'), d('2026-11-10'), d('2026-11-11'), d('2026-11-13'))).toBe(false);
  });
});
