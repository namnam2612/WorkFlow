import clsx from 'clsx';
import type { UserBrief } from '../../types/api';
import { Avatar } from '../ui/Avatar';

interface AssigneeStackProps {
  assignees: UserBrief[];
  /** Số avatar tối đa trước khi gộp thành "+N" */
  max?: number;
  size?: 'xs' | 'sm';
  className?: string;
}

/** Chồng avatar những người được giao: tối đa `max` người, còn lại "+N"; rê chuột hiện tên đầy đủ */
export function AssigneeStack({ assignees, max = 3, size = 'xs', className }: AssigneeStackProps) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const rest = assignees.slice(max);
  const ring = 'ring-2 ring-card';
  return (
    <span className={clsx('inline-flex items-center', className)} aria-label={`Người thực hiện: ${assignees.map((a) => a.name).join(', ')}`}>
      {shown.map((user, index) => (
        <span key={user.id} className={clsx('inline-flex rounded-full', index > 0 && '-ml-1', ring)}>
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size={size === 'xs' ? 'stack' : size} />
        </span>
      ))}
      {rest.length > 0 && (
        <span
          title={rest.map((a) => a.name).join(', ')}
          className={clsx(
            'tabular -ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.16] font-semibold text-slate-700',
            ring,
            size === 'xs' ? 'h-6 min-w-6 px-1 text-[9px]' : 'h-7 min-w-7 px-1.5 text-[11px]',
          )}
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}
