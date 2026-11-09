import type { CSSProperties } from 'react';
import type { ProjectStatus, StatusRef, StatusScope, Task } from '../types/api';

/** Huy hiệu: chữ = màu trạng thái trộn với màu chữ của theme (đủ tương phản cả nền sáng/tối), nền và viền là màu trạng thái nhạt */
export function statusBadgeStyle(color: string): CSSProperties {
  return {
    color: `color-mix(in srgb, ${color} 72%, var(--text))`,
    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
    // ring-inset của Tailwind đọc biến --tw-ring-color
    ['--tw-ring-color' as string]: `color-mix(in srgb, ${color} 38%, transparent)`,
  };
}

export const isDoneStatus = (status: Pick<StatusRef, 'category'>): boolean => status.category === 'done';

/** Task đã hoàn thành (thuộc nhóm "done") */
export const isDone = (task: Pick<Task, 'status'>): boolean => isDoneStatus(task.status);

/** Trạng thái đầu tiên của bộ `scope` thuộc nhóm `done` (hoặc nhóm chưa xong) — dùng cho ô tích "hoàn thành" */
export function pickStatus(statuses: ProjectStatus[], scope: StatusScope, done: boolean): ProjectStatus | undefined {
  return statuses.filter((s) => s.scope === scope && (s.category === 'done') === done).sort((a, b) => a.position - b.position)[0];
}
