import clsx from 'clsx';
import { DEFAULT_NOTIFICATION_META, NOTIFICATION_META } from '../../lib/notification-meta';
import { formatRelative } from '../../lib/format';
import type { AppNotification } from '../../types/api';

export function NotificationItem({ notification, onClick }: { notification: AppNotification; onClick: () => void }) {
  const meta = NOTIFICATION_META[notification.type] ?? DEFAULT_NOTIFICATION_META;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50', !notification.isRead && 'bg-brand-50/50')}
    >
      <span className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.color)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-sm', notification.isRead ? 'text-slate-600' : 'font-medium text-slate-900')}>{notification.message}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{formatRelative(notification.createdAt)}</span>
      </span>
      {!notification.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Chưa đọc" />}
    </button>
  );
}
