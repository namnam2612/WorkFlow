import type { ActivityLogEntry } from '../types/api';
import { PRIORITY_META, STATUS_META } from './constants';
import { formatDateTime } from './format';
import type { Priority, TaskStatus } from '../types/api';

function statusLabel(value: unknown): string {
  return typeof value === 'string' && value in STATUS_META ? STATUS_META[value as TaskStatus].label : String(value ?? '—');
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

/** Diễn giải một dòng activity log thành câu tiếng Việt (không gồm tên người thực hiện) */
export function describeActivity(entry: ActivityLogEntry): string {
  const detail = entry.detail ?? {};
  switch (entry.action) {
    case 'task_created':
      return 'đã tạo công việc';
    case 'status_changed':
      return `đã đổi trạng thái từ "${statusLabel(detail.from)}" sang "${statusLabel(detail.to)}"`;
    case 'assignee_changed':
      return `đã đổi người thực hiện từ ${personName(detail.from)} sang ${personName(detail.to)}`;
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
    case 'subtask_added':
      return `đã thêm công việc con "${String(detail.title ?? '')}"`;
    default:
      return entry.action;
  }
}
