const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;
const MAX_DAYS = 120;

const vnDayStart = (d: Date): number => Math.floor((d.getTime() + VN_OFFSET) / DAY) * DAY - VN_OFFSET;

export interface BurndownTask {
  /** Story Point; null = chưa ước lượng */
  points: number | null;
  completedAt: Date | null;
}

export interface BurndownPoint {
  /** Ngày (00:00 giờ VN) dạng ISO UTC */
  date: string;
  /** Đường lý tưởng: giảm đều từ mức cam kết về 0 */
  ideal: number;
  /** Còn lại thực tế cuối ngày; null cho những ngày chưa tới */
  remaining: number | null;
}

export interface Burndown {
  unit: 'points' | 'tasks';
  /** Mức cam kết lúc bắt đầu sprint (hoặc phạm vi hiện tại nếu sprint chưa bắt đầu) */
  committed: number;
  /** Phạm vi hiện tại (có thể lớn hơn cam kết nếu thêm việc giữa sprint) */
  scope: number;
  points: BurndownPoint[];
}

/**
 * Burndown theo ngày làm việc giờ Việt Nam. Còn lại = phạm vi hiện tại − tổng điểm các việc đã xong đến hết ngày đó.
 * Nếu chưa việc nào có Story Point thì đếm theo số việc để biểu đồ vẫn có nghĩa.
 * Hạn chế: dựa vào completedAt nên việc mở lại sau khi xong chỉ được tính theo trạng thái hiện tại.
 */
export function buildBurndown(input: { startDate: Date; endDate: Date; committedPoints: number | null; tasks: BurndownTask[]; now: Date }): Burndown {
  const { startDate, endDate, tasks, now } = input;
  const anyPoints = tasks.some((t) => (t.points ?? 0) > 0);
  const unit: Burndown['unit'] = anyPoints ? 'points' : 'tasks';
  const weight = (t: BurndownTask): number => (unit === 'points' ? (t.points ?? 0) : 1);
  const scope = tasks.reduce((sum, t) => sum + weight(t), 0);
  const committed = unit === 'points' ? (input.committedPoints ?? scope) : scope;

  const first = vnDayStart(startDate);
  const last = Math.max(first, vnDayStart(endDate));
  const days = Math.min(MAX_DAYS, Math.floor((last - first) / DAY) + 1);
  const today = vnDayStart(now);

  const points: BurndownPoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = first + i * DAY;
    const dayEnd = dayStart + DAY;
    const ideal = days === 1 ? 0 : committed * (1 - i / (days - 1));
    const remaining = dayStart > today ? null : scope - tasks.filter((t) => t.completedAt !== null && t.completedAt.getTime() < dayEnd).reduce((s, t) => s + weight(t), 0);
    points.push({ date: new Date(dayStart).toISOString(), ideal: Math.round(ideal * 100) / 100, remaining });
  }
  return { unit, committed, scope, points };
}
