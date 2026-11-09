import type { Priority, Role, TaskStatus } from '../types/api';

export const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const STATUS_META: Record<TaskStatus, { label: string; badge: string; dot: string; column: string }> = {
  todo: { label: 'Cần làm', badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', column: 'border-slate-300' },
  in_progress: { label: 'Đang làm', badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500', column: 'border-blue-400' },
  review: { label: 'Chờ duyệt', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', column: 'border-amber-400' },
  done: { label: 'Hoàn thành', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', column: 'border-emerald-400' },
  blocked: { label: 'Bị chặn', badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', column: 'border-rose-400' },
};

// Màu trạng thái trên nền tối (màu chỉ mang ý nghĩa trạng thái). Kèm mã hóa phụ (legend, nhãn số, khe 2px, tooltip, bảng).
const STATUS_CHART_COLORS_DARK: Record<TaskStatus, string> = {
  todo: '#8cc0ff',
  in_progress: '#ffd561',
  review: '#c5a6ff',
  done: '#7ee2a8',
  blocked: '#ff8a8a',
};

// Bản cho nền sáng: đậm hơn để đủ tương phản trên nền trắng
const STATUS_CHART_COLORS_LIGHT: Record<TaskStatus, string> = {
  todo: '#2272e6',
  in_progress: '#e0a100',
  review: '#7048e8',
  done: '#2f9e44',
  blocked: '#e03131',
};

export function statusChartColors(theme: 'dark' | 'light'): Record<TaskStatus, string> {
  return theme === 'light' ? STATUS_CHART_COLORS_LIGHT : STATUS_CHART_COLORS_DARK;
}

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  low: { label: 'Thấp', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  medium: { label: 'Trung bình', badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
  high: { label: 'Cao', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
  urgent: { label: 'Khẩn cấp', badge: 'bg-red-50 text-red-700 ring-red-200' },
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị viên',
  leader: 'Trưởng nhóm',
  member: 'Thành viên',
};

export const ACTION_LABEL: Record<string, string> = {
  task_created: 'đã tạo công việc',
  status_changed: 'đã đổi trạng thái',
  assignee_changed: 'đã đổi người thực hiện',
  priority_changed: 'đã đổi mức ưu tiên',
  deadline_changed: 'đã đổi deadline',
  title_changed: 'đã đổi tiêu đề',
  description_changed: 'đã sửa mô tả',
  hours_changed: 'đã cập nhật giờ làm',
  comment_added: 'đã bình luận',
  subtask_added: 'đã thêm công việc con',
  attachment_added: 'đã đính kèm file',
  attachment_removed: 'đã xóa file đính kèm',
};
