import type { ActivityLogEntry } from '../types/api';
import { PRIORITY_META, TYPE_LABEL, SEVERITY_META, ENVIRONMENT_LABEL } from './constants';
import { formatMinutes } from './duration';
import { formatDateTime } from './format';
import type { BugSeverity, Environment, Priority, TaskType } from '../types/api';

/** Log mới lưu {id, name}; log cũ lưu khóa của 5 trạng thái cố định trước đây */
const LEGACY_STATUS_LABEL: Record<string, string> = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Chờ duyệt', done: 'Hoàn thành', blocked: 'Bị chặn' };
function statusLabel(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value && typeof (value as { name: unknown }).name === 'string') return (value as { name: string }).name;
  return typeof value === 'string' ? (LEGACY_STATUS_LABEL[value] ?? value) : '—';
}

const typeLabel = (v: unknown): string => (typeof v === 'string' && v in TYPE_LABEL ? TYPE_LABEL[v as TaskType] : '—');
function bugValue(field: unknown, v: unknown): string {
  if (typeof v !== 'string') return 'không có';
  if (field === 'severity') return v in SEVERITY_META ? SEVERITY_META[v as BugSeverity].label : v;
  return v in ENVIRONMENT_LABEL ? ENVIRONMENT_LABEL[v as Environment] : v;
}

function priorityLabel(value: unknown): string {
  return typeof value === 'string' && value in PRIORITY_META ? PRIORITY_META[value as Priority].label : String(value ?? '—');
}

function personName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return 'không ai';
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.map(personName) : [];
}

/**
 * "đã giao việc cho B, C" / "đã bỏ A khỏi công việc" / cả hai.
 * Hỗ trợ cả dòng log cũ (một người: from/to) lẫn mới (nhiều người: added/removed).
 */
export function describeAssigneeChange(detail: Record<string, unknown>): string {
  if (!('added' in detail) && !('removed' in detail)) {
    return `đã đổi người thực hiện từ ${personName(detail.from)} sang ${personName(detail.to)}`;
  }
  const added = names(detail.added);
  const removed = names(detail.removed);
  const parts: string[] = [];
  if (added.length > 0) parts.push(`đã giao việc cho ${added.join(', ')}`);
  if (removed.length > 0) parts.push(detail.reason === 'removed_from_project' ? `đã gỡ ${removed.join(', ')} khỏi công việc (rời dự án)` : `đã bỏ ${removed.join(', ')} khỏi công việc`);
  return parts.length > 0 ? parts.join('; ') : 'đã cập nhật người thực hiện';
}

/** Diễn giải một dòng activity log thành câu tiếng Việt (không gồm tên người thực hiện) */
export function describeActivity(entry: ActivityLogEntry): string {
  const detail = entry.detail ?? {};
  switch (entry.action) {
    case 'task_created':
      return 'đã tạo công việc';
    case 'status_changed':
      return `đã đổi trạng thái từ "${statusLabel(detail.from)}" sang "${statusLabel(detail.to)}"`;
    case 'assignee_changed':
      return describeAssigneeChange(detail);
    case 'type_changed':
      return `đã đổi loại từ "${typeLabel(detail.from)}" sang "${typeLabel(detail.to)}"`;
    case 'story_points_changed':
      return `đã đổi Story Point: ${String(detail.from ?? '—')} → ${String(detail.to ?? '—')}`;
    case 'sprint_changed': {
      const name = (v: unknown) => (v && typeof v === 'object' && 'name' in v ? String((v as { name: unknown }).name) : 'Backlog');
      return `đã chuyển sprint từ "${name(detail.from)}" sang "${name(detail.to)}"`;
    }
    case 'epic_changed': {
      const title = (v: unknown) => (v && typeof v === 'object' && 'title' in v ? String((v as { title: unknown }).title) : 'không có');
      return `đã đổi epic từ "${title(detail.from)}" sang "${title(detail.to)}"`;
    }
    case 'worklog_added':
      return `đã ghi nhận ${formatMinutes(Number(detail.minutes ?? 0))} làm việc${detail.note ? `: ${String(detail.note)}` : ''}`;
    case 'worklog_removed':
      return `đã xóa bản ghi ${formatMinutes(Number(detail.minutes ?? 0))} làm việc`;
    case 'bug_info_changed':
      return `đã đổi ${detail.field === 'severity' ? 'mức độ nghiêm trọng' : 'môi trường'} của Bug: ${bugValue(detail.field, detail.from)} → ${bugValue(detail.field, detail.to)}`;
    case 'priority_changed':
      return `đã đổi mức ưu tiên từ "${priorityLabel(detail.from)}" sang "${priorityLabel(detail.to)}"`;
    case 'deadline_changed': {
      const from = typeof detail.from === 'string' ? formatDateTime(detail.from) : 'không có';
      const to = typeof detail.to === 'string' ? formatDateTime(detail.to) : 'không có';
      return `đã đổi deadline từ ${from} sang ${to}`;
    }
    case 'title_changed':
      return `đã đổi tiêu đề thành "${String(detail.to ?? '')}"`;
    case 'description_changed':
      return 'đã sửa mô tả';
    case 'hours_changed': {
      const field = detail.field === 'estimatedHours' ? 'giờ ước tính' : 'giờ thực tế';
      return `đã cập nhật ${field}: ${String(detail.from ?? '—')} → ${String(detail.to ?? '—')}`;
    }
    case 'comment_added':
      return 'đã bình luận';
    case 'attachment_added':
      return `đã đính kèm file ${String(detail.name ?? '')}`;
    case 'attachment_removed':
      return `đã xóa file đính kèm ${String(detail.name ?? '')}`;
    case 'subtask_added':
      return `đã thêm công việc con "${String(detail.title ?? '')}"`;
    default:
      return entry.action;
  }
}
