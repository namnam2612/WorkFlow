import clsx from 'clsx';
import { CalendarClock } from 'lucide-react';
import { daysUntil, deadlineLabel, isOverdue } from '../../lib/format';
import type { Task } from '../../types/api';

/** Hiển thị deadline: đỏ khi quá hạn, cam khi sắp đến hạn (<= 3 ngày) */
export function DeadlineText({ task, className }: { task: Pick<Task, 'deadline' | 'status'>; className?: string }) {
  if (!task.deadline) return <span className={clsx('text-xs text-slate-400', className)}>Không có deadline</span>;
  const overdue = isOverdue(task);
  const soon = !overdue && task.status.category !== 'done' && daysUntil(task.deadline) <= 3;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium',
        overdue ? 'text-red-600' : soon ? 'text-orange-600' : 'text-slate-500',
        className,
      )}
    >
      <CalendarClock className="h-3.5 w-3.5" />
      {deadlineLabel(task)}
    </span>
  );
}
