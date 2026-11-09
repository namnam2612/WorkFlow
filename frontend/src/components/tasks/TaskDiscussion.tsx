import clsx from 'clsx';
import { Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useActivity, useCommentMutations, useComments } from '../../hooks/useComments';
import { describeActivity } from '../../lib/activity';
import { getErrorMessage } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { inputClass } from '../../lib/styles';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../ui/States';
import { useToast } from '../ui/useToast';

type Tab = 'comments' | 'activity';

interface TaskDiscussionProps {
  taskId: number;
  /** Người dùng hiện tại được phép bình luận (leader/admin của dự án, người được giao, hoặc người phụ trách công việc con) */
  canComment: boolean;
  /** Được xóa bình luận của người khác (leader/admin của dự án) */
  canModerate: boolean;
}

export function TaskDiscussion({ taskId, canComment, canModerate }: TaskDiscussionProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('comments');
  const [draft, setDraft] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const commentsQuery = useComments(taskId);
  const activityQuery = useActivity(taskId, tab === 'activity');
  const { add, remove } = useCommentMutations(taskId);

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await add.mutateAsync(content);
      setDraft('');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.show('Đã xóa bình luận', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const tabButton = (key: Tab, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={clsx('border-b-2 px-1 pb-2 text-sm font-medium transition', tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{count}</span>}
    </button>
  );

  return (
    <Card>
      <div className="-mt-1 mb-4 flex gap-5 border-b border-slate-200">
        {tabButton('comments', 'Bình luận', commentsQuery.data?.length)}
        {tabButton('activity', 'Lịch sử hoạt động')}
      </div>

      {tab === 'comments' && (
        <div>
          {commentsQuery.isLoading ? (
            <PageLoader />
          ) : commentsQuery.isError ? (
            <ErrorState error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} />
          ) : commentsQuery.data && commentsQuery.data.length === 0 ? (
            <EmptyState title="Chưa có bình luận" description="Hãy là người đầu tiên trao đổi về công việc này." />
          ) : (
            <ul className="space-y-4">
              {commentsQuery.data?.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <Avatar name={comment.user.name} avatarUrl={comment.user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{comment.user.name}</span>
                      <span className="text-xs text-slate-400" title={formatDateTime(comment.createdAt)}>
                        {formatRelative(comment.createdAt)}
                      </span>
                      {(comment.userId === user?.id || canModerate) && (
                        <button type="button" aria-label="Xóa bình luận" onClick={() => setDeleteId(comment.id)} className="ml-auto rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-700">{comment.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            {canComment ? (
              <div className="flex gap-3">
                {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />}
                <div className="min-w-0 flex-1">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
                    }}
                    rows={3}
                    maxLength={5000}
                    placeholder="Viết bình luận... (Ctrl/⌘ + Enter để gửi)"
                    aria-label="Nội dung bình luận"
                    className={inputClass}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" icon={<Send className="h-4 w-4" />} disabled={!draft.trim()} loading={add.isPending} onClick={() => void submit()}>
                      Gửi
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Bạn chỉ có thể bình luận trên công việc được giao cho mình hoặc công việc con bạn phụ trách.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div>
          {activityQuery.isLoading ? (
            <PageLoader />
          ) : activityQuery.isError ? (
            <ErrorState error={activityQuery.error} onRetry={() => void activityQuery.refetch()} />
          ) : activityQuery.data && activityQuery.data.length === 0 ? (
            <EmptyState title="Chưa có hoạt động nào" />
          ) : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {activityQuery.data?.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-slate-200" />
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{entry.user.name}</span> {describeActivity(entry)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <ConfirmDialog open={deleteId !== null} title="Xóa bình luận" message="Bạn có chắc muốn xóa bình luận này?" loading={remove.isPending} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteId(null)} />
    </Card>
  );
}
