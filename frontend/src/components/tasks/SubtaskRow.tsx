import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useUpdateTask } from '../../hooks/useTasks';
import { getErrorMessage } from '../../lib/api';
import type { Task } from '../../types/api';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/useToast';
import { DeadlineText } from './DeadlineText';

interface SubtaskRowProps {
  subtask: Task;
  /** Người dùng hiện tại được phép đổi trạng thái công việc con này */
  canToggle: boolean;
}

export function SubtaskRow({ subtask, canToggle }: SubtaskRowProps) {
  const toast = useToast();
  const update = useUpdateTask(subtask.id);
  const done = subtask.status === 'done';

  const toggle = async () => {
    try {
      await update.mutateAsync({ status: done ? 'todo' : 'done' });
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        disabled={!canToggle || update.isPending}
        onChange={() => void toggle()}
        aria-label={`Hoàn thành "${subtask.title}"`}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 disabled:cursor-not-allowed"
      />
      <Link to={`/tasks/${subtask.id}`} className={clsx('min-w-0 flex-1 truncate text-sm hover:text-brand-700', done ? 'text-slate-400 line-through' : 'text-slate-800')}>
        {subtask.title}
      </Link>
      <DeadlineText task={subtask} className="hidden sm:inline-flex" />
      {subtask.assignee && <Avatar name={subtask.assignee.name} avatarUrl={subtask.assignee.avatarUrl} size="sm" />}
    </li>
  );
}
