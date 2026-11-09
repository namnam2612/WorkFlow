import clsx from 'clsx';
import { ListChecks, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRIORITY_META } from '../../lib/constants';
import { isOverdue } from '../../lib/format';
import type { Task } from '../../types/api';
import { DeadlineText } from '../tasks/DeadlineText';
import { Avatar } from '../ui/Avatar';

const PRIORITY_BAR: Record<Task['priority'], string> = {
  low: 'bg-slate-300',
  medium: 'bg-sky-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500',
};

interface KanbanCardProps {
  task: Task;
  /** Dạng nổi khi đang kéo (DragOverlay) */
  overlay?: boolean;
  dimmed?: boolean;
  /** Người dùng không được phép kéo thẻ này */
  locked?: boolean;
}

export function KanbanCard({ task, overlay = false, dimmed = false, locked = false }: KanbanCardProps) {
  const overdue = isOverdue(task);
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border bg-card p-3 pl-4 transition-[border-color,box-shadow] duration-300',
        overdue ? 'border-red-300' : 'border-slate-200',
        overlay && 'rotate-2 cursor-grabbing shadow-[0_22px_50px_var(--shadow-lift)] ring-1 ring-white/30',
        dimmed && 'opacity-40',
        !overlay && !locked && 'cursor-grab hover:border-slate-300 hover:shadow-[0_22px_50px_var(--shadow-lift)]',
      )}
    >
      <span className={clsx('absolute inset-y-0 left-0 w-1', PRIORITY_BAR[task.priority])} aria-hidden />
      <Link
        to={`/tasks/${task.id}`}
        draggable={false}
        className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand-700"
      >
        {task.title}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">{PRIORITY_META[task.priority].label}</span>
          {task.subtaskTotal > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
              <ListChecks className="h-3 w-3" />
              {task.subtaskDone}/{task.subtaskTotal}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
              <MessageSquare className="h-3 w-3" />
              {task.commentCount}
            </span>
          )}
        </div>
        {task.assignee && <Avatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="xs" />}
      </div>
      {task.deadline && (
        <div className="mt-2">
          <DeadlineText task={task} />
        </div>
      )}
    </div>
  );
}
