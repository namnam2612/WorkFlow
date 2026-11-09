import { AlertTriangle, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { StatusSummary } from '../components/dashboard/StatusSummary';
import { TaskMiniList } from '../components/dashboard/TaskMiniList';
import { WorkloadChart } from '../components/dashboard/WorkloadChart';
import { Card, PageHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useDashboard } from '../hooks/useDashboard';
import { useProjects } from '../hooks/useProjects';
import { chipClass, inputClass } from '../lib/styles';

export default function DashboardPage() {
  const { user } = useAuth();
  const isMember = user?.role === 'member';
  const [projectId, setProjectId] = useState('');
  const [mine, setMine] = useState(false);

  const projectsQuery = useProjects();
  const dashboardQuery = useDashboard({ projectId: projectId ? Number(projectId) : undefined, mine: mine || undefined });
  const data = dashboardQuery.data;

  const scopeButton = (value: boolean, label: string) => (
    <button
      type="button"
      onClick={() => setMine(value)}
      className={chipClass(mine === value)}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user?.name ?? ''}`}
        description={isMember || mine ? 'Tổng quan công việc được giao cho bạn' : 'Tổng quan công việc của cả nhóm'}
        actions={
          <>
            {!isMember && (
              <div className="inline-flex gap-1" role="group" aria-label="Phạm vi thống kê">
                {scopeButton(false, 'Cả nhóm')}
                {scopeButton(true, 'Của tôi')}
              </div>
            )}
            <select aria-label="Lọc theo dự án" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Tất cả dự án</option>
              {projectsQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        }
      />

      {dashboardQuery.isLoading ? (
        <PageLoader />
      ) : dashboardQuery.isError || !data ? (
        <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} />
      ) : data.projectProgress.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu để thống kê" description="Bạn chưa tham gia dự án nào. Hãy tạo dự án hoặc liên hệ trưởng nhóm." />
      ) : (
        <div className="space-y-6">
          <StatusSummary counts={data.statusCounts} total={data.totalTasks} overdueCount={data.overdueCount} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              title={`Quá hạn (${data.overdueCount})`}
              action={data.overdueCount > 0 && <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />}
            >
              {data.overdue.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Không có công việc nào quá hạn 🎉</p>
              ) : (
                <>
                  <TaskMiniList tasks={data.overdue} tone="danger" />
                  {data.overdueCount > data.overdue.length && (
                    <Link to="/tasks?sortBy=deadline&order=asc" className="mt-2 block link-underline text-white">
                      Xem thêm {data.overdueCount - data.overdue.length} công việc
                    </Link>
                  )}
                </>
              )}
            </Card>
            <Card title={`Sắp đến hạn trong 3 ngày (${data.upcomingCount})`} action={<CalendarClock className="h-4 w-4 text-orange-500" aria-hidden />}>
              {data.upcoming.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Không có công việc nào sắp đến hạn</p>
              ) : (
                <TaskMiniList tasks={data.upcoming} tone="warning" />
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card title="Tiến độ dự án" className="lg:col-span-2">
              <ul className="space-y-4">
                {data.projectProgress.map((p) => (
                  <li key={p.projectId}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <Link to={`/projects/${p.projectId}`} className="truncate text-sm font-medium text-slate-800 hover:text-brand-700">
                        {p.name}
                      </Link>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{p.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${p.name}`}>
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.progress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.done}/{p.total} công việc hoàn thành
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Khối lượng công việc theo thành viên" className="lg:col-span-3">
              {data.workload.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Chưa có công việc nào được giao</p> : <WorkloadChart data={data.workload} />}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
