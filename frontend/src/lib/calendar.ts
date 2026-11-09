const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;

/** "YYYY-MM-DD" theo giờ Việt Nam của một mốc thời gian */
export const vnDateKey = (value: string | Date): string => new Date(new Date(value).getTime() + VN_OFFSET).toISOString().slice(0, 10);

/** Mốc UTC của 00:00 giờ VN ngày "YYYY-MM-DD" */
export const vnDayStart = (key: string): number => new Date(`${key}T00:00:00+07:00`).getTime();

export const addDaysKey = (key: string, days: number): string => vnDateKey(new Date(vnDayStart(key) + days * DAY));

export const todayKey = (): string => vnDateKey(new Date());

/** 0 = Thứ Hai ... 6 = Chủ nhật */
export const weekdayIndex = (key: string): number => (new Date(vnDayStart(key) + VN_OFFSET).getUTCDay() + 6) % 7;

export interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
}

/** Lưới tháng, tuần bắt đầu từ Thứ Hai, đủ các tuần che hết tháng (35 hoặc 42 ô) */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const start = addDaysKey(first, -weekdayIndex(first));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((weekdayIndex(first) + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const key = addDaysKey(start, i);
    return { key, day: Number(key.slice(8, 10)), inMonth: key.slice(0, 7) === first.slice(0, 7) };
  });
}

/** Các ngày (key) từ start tới end, cả hai đầu */
export function eachDayKey(start: string, end: string): string[] {
  const result: string[] = [];
  for (let k = start; k <= end && result.length < 400; k = addDaysKey(k, 1)) result.push(k);
  return result;
}

export const monthTitle = (year: number, month: number): string => `Tháng ${month + 1}/${year}`;
