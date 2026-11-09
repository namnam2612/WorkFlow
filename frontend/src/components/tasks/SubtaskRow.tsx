import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useProjectStatuses } from '../../hooks/useStatuses';
import { useUpdateTask } from '../../hooks/useTasks';
import { getErrorMessage } from '../../lib/api';
import { pickStatus } from '../../lib/status';
import type { Task } from '../../types/api';
import { AssigneeStack } from '../assignees/AssigneeStack';
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
  const statuses = useProjectStatuses(subtask.projectId);
  const done = subtask.status.category === 'done';

  const toggle = async () => {
    // Ô tích chuyển giữa trạng thái "xong" đầu tiên và trạng thái "chưa xong" đầu tiên của đúng bộ (công việc / Bug)
    const target = pickStatus(statuses.data ?? [], subtask.status.scope, !done);
    if (!target) return;
    try {
      await update.mutateAsync({ statusId: target.id });
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        disabled={!canToggle || update.isPending || !statuses.data}
        onChange={() => void toggle()}
        aria-label={`Hoàn thành "${subtask.title}"`}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 disabled:cursor-not-allowed"
      />
      <Link to={`/tasks/${subtask.id}`} className={clsx('min-w-0 flex-1 truncate text-sm hover:text-brand-700', done ? 'text-slate-400 line-through' : 'text-slate-800')}>
        {subtask.title}
      </Link>
      <DeadlineText task={subtask} className="hidden sm:inline-flex" />
      <AssigneeStack assignees={subtask.assignees} size="sm" />
    </li>
  );
}
