import clsx from 'clsx';
import { ArrowDown, ArrowUp, ListChecks, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isOverdue } from '../../lib/format';
import type { Task, TaskFilters } from '../../types/api';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge, StatusBadge } from '../ui/Badges';
import { DeadlineText } from './DeadlineText';

type SortKey = NonNullable<TaskFilters['sortBy']>;

interface TaskTableProps {
  tasks: Task[];
  showProject?: boolean;
  sortBy?: SortKey;
  order?: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
}

function SortableTh({ label, field, sortBy, order, onSort, className }: { label: string; field: SortKey } & Pick<TaskTableProps, 'sortBy' | 'order' | 'onSort'> & { className?: string }) {
  const active = sortBy === field;
  return (
    <th scope="col" className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', className)}>
      {onSort ? (
        <button type="button" onClick={() => onSort(field)} className={clsx('inline-flex items-center gap-1 uppercase hover:text-slate-800', active && 'text-brand-700')}>
          {label}
          {active && (order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function TaskTable({ tasks, showProject = true, sortBy, order, onSort }: TaskTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <SortableTh label="Công việc" field="title" sortBy={sortBy} order={order} onSort={onSort} />
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Người thực hiện
            </th>
            <SortableTh label="Trạng thái" field="status" sortBy={sortBy} order={order} onSort={onSort} />
            <SortableTh label="Ưu tiên" field="priority" sortBy={sortBy} order={order} onSort={onSort} />
            <SortableTh label="Deadline" field="deadline" sortBy={sortBy} order={order} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <tr key={task.id} className={clsx('hover:bg-slate-50', isOverdue(task) && 'bg-red-50/40')}>
              <td className="max-w-md px-4 py-3">
                <Link to={`/tasks/${task.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                  {task.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {showProject && task.project && <span>{task.project.name}</span>}
                  {task.subtaskTotal > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" />
                      {task.subtaskDone}/{task.subtaskTotal}
                    </span>
                  )}
                  {task.commentCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {task.commentCount}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="sm" />
                    <span className="whitespace-nowrap text-sm text-slate-700">{task.assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Chưa giao</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={task.status} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={task.priority} />
              </td>
              <td className="px-4 py-3">
                <DeadlineText task={task} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
