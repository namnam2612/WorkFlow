import { chipClass } from '../lib/styles';
import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem } from '../components/notifications/NotificationItem';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useNotificationList, useNotificationMutations, useUnreadCount } from '../hooks/useNotifications';
import type { AppNotification } from '../types/api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const listQuery = useNotificationList({ page, pageSize: 20, unread: unreadOnly || undefined });
  const unread = useUnreadCount().data ?? 0;
  const { markRead, markAllRead } = useNotificationMutations();

  const open = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.link) navigate(notification.link);
  };

  const filterButton = (value: boolean, label: string) => (
    <button
      type="button"
      onClick={() => {
        setUnreadOnly(value);
        setPage(1);
      }}
      className={chipClass(unreadOnly === value)}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Thông báo"
        description={unread > 0 ? `Bạn có ${unread} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
        actions={
          <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} disabled={unread === 0} loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        {filterButton(false, 'Tất cả')}
        {filterButton(true, 'Chưa đọc')}
      </div>

      {listQuery.isLoading ? (
        <PageLoader />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : listQuery.data && listQuery.data.items.length === 0 ? (
        <EmptyState title={unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'} description="Thông báo về giao việc, bình luận và deadline sẽ xuất hiện ở đây." />
      ) : (
        listQuery.data && (
          <>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
              {listQuery.data.items.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onClick={() => open(notification)} />
              ))}
            </div>
            <Pagination page={listQuery.data.page} totalPages={listQuery.data.totalPages} total={listQuery.data.total} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
