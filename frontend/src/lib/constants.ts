import type { BugSeverity, Environment, LeaveStatus, LeaveType, Priority, Role, Specialty, StatusCategory, TaskType, TestResultStatus } from '../types/api';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const CATEGORIES: StatusCategory[] = ['todo', 'in_progress', 'done'];
export const CATEGORY_LABEL: Record<StatusCategory, string> = { todo: 'Cần làm', in_progress: 'Đang làm', done: 'Hoàn thành' };

// Màu theo NHÓM trạng thái trên biểu đồ tổng hợp (mỗi dự án có bộ trạng thái riêng nên không thể một màu một trạng thái).
// Kèm mã hóa phụ (legend, nhãn số, khe 2px, tooltip, bảng).
const CATEGORY_CHART_COLORS_DARK: Record<StatusCategory, string> = { todo: '#8cc0ff', in_progress: '#ffd561', done: '#7ee2a8' };
// Bản cho nền sáng: đậm hơn để đủ tương phản trên nền trắng
const CATEGORY_CHART_COLORS_LIGHT: Record<StatusCategory, string> = { todo: '#2272e6', in_progress: '#e0a100', done: '#2f9e44' };

export function categoryChartColors(theme: 'dark' | 'light'): Record<StatusCategory, string> {
  return theme === 'light' ? CATEGORY_CHART_COLORS_LIGHT : CATEGORY_CHART_COLORS_DARK;
}

export const TYPES: TaskType[] = ['task', 'story', 'bug', 'epic'];
export const TYPE_LABEL: Record<TaskType, string> = { task: 'Công việc', story: 'User Story', bug: 'Bug', epic: 'Epic' };

export const SEVERITIES: BugSeverity[] = ['minor', 'major', 'critical', 'blocker'];
export const SEVERITY_META: Record<BugSeverity, { label: string; badge: string }> = {
  minor: { label: 'Nhẹ', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  major: { label: 'Vừa', badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
  critical: { label: 'Nghiêm trọng', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
  blocker: { label: 'Chặn phát hành', badge: 'bg-red-50 text-red-700 ring-red-200' },
};

export const ENVIRONMENTS: Environment[] = ['dev', 'staging', 'prod'];
export const ENVIRONMENT_LABEL: Record<Environment, string> = { dev: 'Dev', staging: 'Staging', prod: 'Production' };

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
  type_changed: 'đã đổi loại công việc',
  story_points_changed: 'đã đổi Story Point',
  bug_info_changed: 'đã cập nhật thông tin Bug',
  attachment_removed: 'đã xóa file đính kèm',
};

/** Giao diện biểu đồ theo theme (lưới, chữ trục, nền cắt khe) */
export const CHART_CHROME = {
  dark: { surface: '#111111', grid: 'rgba(255,255,255,0.08)', ink: '#888888', cursor: 'rgba(255,255,255,0.05)', line: '#ffffff', accent: '#7ee2a8', warn: '#ffd561' },
  light: { surface: '#ffffff', grid: 'rgba(0,0,0,0.1)', ink: '#6b6b6b', cursor: 'rgba(0,0,0,0.04)', line: '#0a0a0a', accent: '#2f9e44', warn: '#e0a100' },
} as const;

export const SPECIALTIES: Specialty[] = ['dev', 'qa', 'designer', 'other'];
export const SPECIALTY_LABEL: Record<Specialty, string> = { dev: 'Dev', qa: 'QA', designer: 'Designer', other: 'Khác' };

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = { annual: 'Phép năm', sick: 'Nghỉ ốm', unpaid: 'Nghỉ không lương', other: 'Khác' };
export const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; badge: string }> = {
  pending: { label: 'Chờ duyệt', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { label: 'Đã duyệt', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Từ chối', badge: 'bg-red-50 text-red-700 ring-red-200' },
  cancelled: { label: 'Đã hủy', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export const RESULT_META: Record<TestResultStatus, { label: string; badge: string }> = {
  untested: { label: 'Chưa chạy', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  passed: { label: 'Đạt', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'Lỗi', badge: 'bg-red-50 text-red-700 ring-red-200' },
  blocked: { label: 'Bị chặn', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  skipped: { label: 'Bỏ qua', badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
};
