import clsx from 'clsx';
import { Link } from 'react-router-dom';
import type { Task } from '../../types/api';
import { DeadlineText } from '../tasks/DeadlineText';
import { AssigneeStack } from '../assignees/AssigneeStack';

export function TaskMiniList({ tasks, tone }: { tasks: Task[]; tone: 'danger' | 'warning' }) {
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 py-2.5">
          <span className={clsx('h-8 w-1 shrink-0 rounded-full', tone === 'danger' ? 'bg-red-500' : 'bg-orange-400')} aria-hidden />
          <div className="min-w-0 flex-1">
            <Link to={`/tasks/${task.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
              {task.title}
            </Link>
            <p className="truncate text-xs text-slate-500">{task.project?.name}</p>
          </div>
          <DeadlineText task={task} />
          <AssigneeStack assignees={task.assignees} size="sm" />
        </li>
      ))}
    </ul>
  );
}
