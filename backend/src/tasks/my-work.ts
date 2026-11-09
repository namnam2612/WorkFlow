const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Asia/Ho_Chi_Minh = UTC+7, không có giờ mùa hè */
const VN_OFFSET = 7 * HOUR;

/** 00:00 (giờ Việt Nam) của ngày chứa `now`, trả về dạng thời điểm UTC */
export function startOfVnDay(now: Date): Date {
  return new Date(Math.floor((now.getTime() + VN_OFFSET) / DAY) * DAY - VN_OFFSET);
}

export interface MyWorkWindow {
  todayStart: Date;
  tomorrowStart: Date;
  /** Hết 7 ngày tới (độc quyền) */
  weekEnd: Date;
}

export function myWorkWindow(now: Date): MyWorkWindow {
  const todayStart = startOfVnDay(now);
  return { todayStart, tomorrowStart: new Date(todayStart.getTime() + DAY), weekEnd: new Date(todayStart.getTime() + 8 * DAY) };
}

export type MyWorkBucket = 'overdue' | 'dueToday' | 'inProgress' | 'upcoming';

/**
 * Xếp một task chưa xong vào đúng MỘT nhóm theo thứ tự ưu tiên: quá hạn > hạn hôm nay > đang làm > sắp tới (7 ngày).
 * Không thuộc nhóm nào (vd chưa làm và chưa có deadline gần) => null.
 */
export function bucketOf(task: { deadline: Date | null; category: 'todo' | 'in_progress' | 'done' }, window: MyWorkWindow): MyWorkBucket | null {
  if (task.category === 'done') return null;
  const t = task.deadline?.getTime() ?? null;
  if (t !== null && t < window.todayStart.getTime()) return 'overdue';
  if (t !== null && t < window.tomorrowStart.getTime()) return 'dueToday';
  if (task.category === 'in_progress') return 'inProgress';
  if (t !== null && t < window.weekEnd.getTime()) return 'upcoming';
  return null;
}
