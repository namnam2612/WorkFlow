import clsx from 'clsx';
import { PRIORITY_META, STATUS_META } from '../../lib/constants';
import type { Priority, TaskStatus } from '../../types/api';

const BASE = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={clsx(BASE, meta.badge)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return <span className={clsx(BASE, meta.badge)}>{meta.label}</span>;
}
