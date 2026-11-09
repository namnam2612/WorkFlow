import clsx from 'clsx';
import { Bug, CheckSquare, BookOpen, Zap, type LucideIcon } from 'lucide-react';
import { PRIORITY_META, SEVERITY_META, TYPE_LABEL } from '../../lib/constants';
import { statusBadgeStyle } from '../../lib/status';
import type { BugSeverity, Priority, StatusRef, TaskType } from '../../types/api';

const BASE = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

/** Huy hiệu trạng thái: màu do dự án đặt, trộn với màu chữ của giao diện nên đọc được ở cả nền tối lẫn sáng */
export function StatusBadge({ status }: { status: Pick<StatusRef, 'name' | 'color'> }) {
  return (
    <span className={BASE} style={statusBadgeStyle(status.color)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
      {status.name}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return <span className={clsx(BASE, meta.badge)}>{meta.label}</span>;
}

const TYPE_ICON: Record<TaskType, LucideIcon> = { task: CheckSquare, story: BookOpen, bug: Bug, epic: Zap };

/** Biểu tượng loại công việc (Bug, Story, Epic); loại "Công việc" thường không cần hiển thị nên có thể ẩn bằng hideTask */
export function TypeBadge({ type, hideTask = false, className }: { type: TaskType; hideTask?: boolean; className?: string }) {
  if (hideTask && type === 'task') return null;
  const Icon = TYPE_ICON[type];
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium text-slate-600', type === 'bug' && 'text-red-600', className)} title={TYPE_LABEL[type]}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {TYPE_LABEL[type]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: BugSeverity }) {
  const meta = SEVERITY_META[severity];
  return <span className={clsx(BASE, meta.badge)}>{meta.label}</span>;
}
