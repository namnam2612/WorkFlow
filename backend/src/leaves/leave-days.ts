const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;

/** Số giờ làm mỗi ngày dùng để quy đổi capacity */
export const HOURS_PER_DAY = 8;

/** Thứ trong tuần theo giờ VN của một mốc 00:00 VN: 0 = Chủ nhật ... 6 = Thứ bảy */
const weekdayVn = (dayStart: number): number => new Date(dayStart + VN_OFFSET).getUTCDay();

/** 00:00 VN của ngày chứa `date` (UTC ms) */
export const vnDayStartMs = (date: Date): number => Math.floor((date.getTime() + VN_OFFSET) / DAY) * DAY - VN_OFFSET;

/** Các ngày làm việc (Thứ 2–Thứ 6, giờ VN) trong [from, to] — cả hai đầu, mốc 00:00 VN, dạng ms */
export function workingDays(from: Date, to: Date): number[] {
  const result: number[] = [];
  const end = vnDayStartMs(to);
  for (let t = vnDayStartMs(from); t <= end; t += DAY) {
    const wd = weekdayVn(t);
    if (wd !== 0 && wd !== 6) result.push(t);
  }
  return result;
}

/** Số ngày làm việc của một đơn nghỉ [leaveStart, leaveEnd] nằm trong [from, to] */
export function leaveWorkingDaysIn(leaveStart: Date, leaveEnd: Date, from: Date, to: Date): number {
  const a = Math.max(vnDayStartMs(leaveStart), vnDayStartMs(from));
  const b = Math.min(vnDayStartMs(leaveEnd), vnDayStartMs(to));
  if (b < a) return 0;
  return workingDays(new Date(a), new Date(b)).length;
}

/** Hai khoảng ngày [aStart, aEnd] và [bStart, bEnd] có chung ít nhất một ngày không (cả hai đầu) */
export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  vnDayStartMs(aStart) <= vnDayStartMs(bEnd) && vnDayStartMs(bStart) <= vnDayStartMs(aEnd);
