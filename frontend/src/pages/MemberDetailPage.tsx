import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ContactInfo } from '../components/profile/ContactInfo';
import { Card } from '../components/ui/Card';
import { TaskTable } from '../components/tasks/TaskTable';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useTasks } from '../hooks/useTasks';
import { useUser } from '../hooks/useUsers';
import { ROLE_LABEL } from '../lib/constants';
import type { TaskFilters } from '../types/api';

type TabKey = 'in_progress' | 'todo' | 'done' | 'overdue';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'in_progress', label: 'Đang làm' },
  { key: 'todo', label: 'Cần làm' },
  { key: 'done', label: 'Đã xong' },
  { key: 'overdue', label: 'Quá hạn' },
];

const TAB_FILTERS: Record<TabKey, Partial<TaskFilters> & { overdue?: boolean }> = {
  in_progress: { statusCategory: 'in_progress' },
  todo: { statusCategory: 'todo' },
  done: { statusCategory: 'done' },
  overdue: { overdue: true },
};

export default function MemberDetailPage() {
  const { id } = useParams();
  const userId = Number(id);
  const [tab, setTab] = useState<TabKey>('in_progress');

  const userQuery = useUser(userId);
  const tasksQuery = useTasks(
    { assigneeIds: [userId], pageSize: 50, sortBy: 'deadline', order: tab === 'done' ? 'desc' : 'asc', ...TAB_FILTERS[tab] },
    !Number.isNaN(userId),
  );

  if (userQuery.isLoading) return <PageLoader />;
  if (userQuery.isError || !userQuery.data) return <ErrorState error={userQuery.error} onRetry={() => void userQuery.refetch()} />;

  const member = userQuery.data;
  const { stats } = member;
  const counts: Record<TabKey, number> = { in_progress: stats.counts.in_progress, todo: stats.counts.todo, done: stats.counts.done, overdue: stats.overdue };

  return (
    <>
      <Link to="/members" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Danh sách thành viên
      </Link>

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900">{member.name}</h1>
          <p className="truncate text-sm text-slate-500">{member.jobTitle ?? member.email}</p>
          <span className="mt-1.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{ROLE_LABEL[member.role]}</span>
        </div>
        <div className="ml-auto hidden text-right sm:block">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">công việc được giao</p>
        </div>
      </div>

      <Card title="Thông tin liên hệ" className="mb-6">
        <ContactInfo user={member} />
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              'rounded-xl border bg-card p-4 text-left shadow-sm transition',
              tab === t.key ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <p className={clsx('text-2xl font-bold', t.key === 'overdue' && counts.overdue > 0 ? 'text-red-600' : 'text-slate-900')}>{counts[t.key]}</p>
            <p className="text-sm text-slate-500">{t.label}</p>
          </button>
        ))}
      </div>

      {tasksQuery.isLoading ? (
        <PageLoader />
      ) : tasksQuery.isError ? (
        <ErrorState error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />
      ) : tasksQuery.data && tasksQuery.data.items.length === 0 ? (
        <EmptyState title="Không có công việc" description={`${member.name} chưa có công việc nào ở mục "${TABS.find((t) => t.key === tab)?.label}".`} />
      ) : (
        tasksQuery.data && <TaskTable tasks={tasksQuery.data.items} />
      )}
    </>
  );
}
