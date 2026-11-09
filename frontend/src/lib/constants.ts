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

export const STATUS_CHART_COLORS: Record<TaskStatus, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
  blocked: '#f43f5e',
};

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
};
