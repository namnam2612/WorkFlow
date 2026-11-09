import clsx from 'clsx';
import { AlertTriangle, CalendarCheck, CalendarClock, CheckCircle2, Hourglass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui/Card';
import { PriorityBadge, StatusBadge, TypeBadge } from '../components/ui/Badges';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { DeadlineText } from '../components/tasks/DeadlineText';
import { useProjectStatuses } from '../hooks/useStatuses';
import { useMyWork, useUpdateTask } from '../hooks/useTasks';
import { getErrorMessage } from '../lib/api';
import { pickStatus } from '../lib/status';
import type { Task } from '../types/api';

/** Một việc trong danh sách "Hôm nay": ô tích để hoàn thành ngay, không cần mở chi tiết */
function Row({ task, tone }: { task: Task; tone: 'danger' | 'warning' | 'info' | 'plain' }) {
  const toast = useToast();
  const update = useUpdateTask(task.id);
  const statuses = useProjectStatuses(task.projectId);
  const complete = async () => {
    const target = pickStatus(statuses.data ?? [], task.status.scope, true);
    if (!target) return;
    try {
      await update.mutateAsync({ statusId: target.id });
      toast.show(`Đã hoàn thành "${task.title}"`, 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };
  return (
    <li className="flex items-center gap-3 py-2.5">
      <input type="checkbox" checked={false} disabled={update.isPending || !statuses.data} onChange={() => void complete()} aria-label={`Hoàn thành "${task.title}"`} className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed" />
      <span className={clsx('h-8 w-1 shrink-0 rounded-full', tone === 'danger' ? 'bg-red-500' : tone === 'warning' ? 'bg-orange-400' : tone === 'info' ? 'bg-sky-400' : 'bg-slate-500')} aria-hidden />
      <div className="min-w-0 flex-1">
        <Link to={`/tasks/${task.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
          {task.title}
        </Link>
        <p className="flex items-center gap-2 truncate text-xs text-slate-500">
          <TypeBadge type={task.type} hideTask />
          {task.project?.name}
        </p>
      </div>
      <span className="hidden sm:inline-flex">
        <StatusBadge status={task.status} />
      </span>
      <span className="hidden md:inline-flex">
        <PriorityBadge priority={task.priority} />
      </span>
      <DeadlineText task={task} />
    </li>
  );
}

function Section({ title, icon, tasks, tone, empty }: { title: string; icon: React.ReactNode; tasks: Task[]; tone: 'danger' | 'warning' | 'info' | 'plain'; empty: string }) {
  return (
    <Card title={`${title} (${tasks.length})`} action={icon}>
      {tasks.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <Row key={t.id} task={t} tone={tone} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "Hôm nay cần làm gì": việc của tôi theo ngày giờ Việt Nam (quá hạn, hạn hôm nay, đang làm, sắp tới) */
export default function MyWorkPage() {
  const query = useMyWork();
  const data = query.data;
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const open = data.overdue.length + data.dueToday.length;
  const nothing = open + data.inProgress.length + data.upcoming.length === 0;

  return (
    <>
      <PageHeader
        title="Hôm nay"
        description={`${today} · ${open > 0 ? `${open} việc cần xử lý` : 'Không còn việc đến hạn'}${data.doneToday > 0 ? ` · đã xong ${data.doneToday} việc` : ''}`}
      />
      {nothing ? (
        <EmptyState title="Bạn không có việc nào cần làm" description="Việc được giao cho bạn (đang làm, đến hạn trong 7 ngày) sẽ hiện ở đây." />
      ) : (
        <div className="space-y-6">
          {data.overdue.length > 0 && <Section title="Quá hạn" icon={<AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />} tasks={data.overdue} tone="danger" empty="" />}
          <Section title="Đến hạn hôm nay" icon={<CalendarCheck className="h-4 w-4 text-orange-400" aria-hidden />} tasks={data.dueToday} tone="warning" empty="Không có việc nào đến hạn hôm nay" />
          <Section title="Đang làm" icon={<Hourglass className="h-4 w-4 text-sky-400" aria-hidden />} tasks={data.inProgress} tone="info" empty="Không có việc nào đang làm" />
          <Section title="Sắp tới (7 ngày)" icon={<CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />} tasks={data.upcoming} tone="plain" empty="Không có việc nào sắp đến hạn" />
        </div>
      )}
      {data.doneToday > 0 && (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> Hôm nay bạn đã hoàn thành {data.doneToday} việc
        </p>
      )}
    </>
  );
}
