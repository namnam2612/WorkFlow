import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotificationList, useNotificationMutations, useUnreadCount } from '../../hooks/useNotifications';
import type { AppNotification } from '../../types/api';
import { Spinner } from '../ui/States';
import { NotificationItem } from './NotificationItem';

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadQuery = useUnreadCount();
  const listQuery = useNotificationList({ page: 1, pageSize: 8 }, open);
  const { markRead, markAllRead } = useNotificationMutations();
  const unread = unreadQuery.data ?? 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleClick = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : 'Thông báo'}
        aria-expanded={open}
        className="relative rounded-full border border-white/[0.08] p-2 text-slate-600 transition duration-300 hover:border-white/25 hover:bg-white/5 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black ring-2 ring-bg [animation:pop_0.5s_var(--ease-bounce)]" key={unread}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/[0.14] bg-modal shadow-[0_40px_100px_rgba(0,0,0,0.7)] [animation:modal-in_0.4s_var(--ease-out)_both]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Thông báo</h2>
            <button
              type="button"
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="inline-flex items-center gap-1 text-xs font-medium text-white transition hover:opacity-70 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Đánh dấu đã đọc
            </button>
          </div>
          <div className="thin-scroll max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : listQuery.data && listQuery.data.items.length > 0 ? (
              listQuery.data.items.map((notification) => <NotificationItem key={notification.id} notification={notification} onClick={() => handleClick(notification)} />)
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Bạn chưa có thông báo nào</p>
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center link-underline text-xs text-white hover:bg-white/5">
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}
