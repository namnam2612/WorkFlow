import { isoToVnDateInput, TIME_ZONE } from './format';

const weekdayFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone: TIME_ZONE, weekday: 'long' });

function shiftDay(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Hôm nay" / "Hôm qua" / "Thứ hai, 09/11/2026" cho một ngày theo giờ Việt Nam */
export function dayLabel(ymd: string, now: Date = new Date()): string {
  const today = isoToVnDateInput(now.toISOString());
  if (ymd === today) return 'Hôm nay';
  if (ymd === shiftDay(today, -1)) return 'Hôm qua';
  const [y, m, d] = ymd.split('-');
  const weekday = weekdayFormatter.format(new Date(`${ymd}T12:00:00+07:00`));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d}/${m}/${y}`;
}

export interface DayGroup<T> {
  /** YYYY-MM-DD theo giờ VN */
  day: string;
  label: string;
  items: T[];
}

/** Gom các phần tử (đã sắp theo thời gian) thành từng nhóm theo ngày VN, giữ nguyên thứ tự */
export function groupByDay<T>(items: T[], getIso: (item: T) => string, now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const day = isoToVnDateInput(getIso(item));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, label: dayLabel(day, now), items: [item] });
  }
  return groups;
}
