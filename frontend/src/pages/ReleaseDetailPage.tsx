import { ArrowLeft, Copy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge, TypeBadge } from '../components/ui/Badges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useRelease } from '../hooks/useReleases';
import { ENVIRONMENT_LABEL } from '../lib/constants';
import { formatDate } from '../lib/format';
import type { Task } from '../types/api';

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2.5">
          <TypeBadge type={t.type} hideTask />
          <Link to={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:text-brand-700">
            {t.title}
          </Link>
          {t.type === 'bug' && t.environment && <span className="rounded-full border border-white/[0.14] px-2 text-[11px] text-slate-600">{ENVIRONMENT_LABEL[t.environment]}</span>}
          <StatusBadge status={t.status} />
        </li>
      ))}
    </ul>
  );
}

export default function ReleaseDetailPage() {
  const { id, releaseId } = useParams();
  const toast = useToast();
  const query = useRelease(Number(releaseId));
  const r = query.data;
  if (query.isLoading) return <PageLoader />;
  if (query.isError || !r) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.notes);
      toast.show('Đã sao chép release notes', 'success');
    } catch {
      toast.show('Không sao chép được, hãy chọn và copy thủ công', 'error');
    }
  };
  const byEnv = (['dev', 'staging', 'prod'] as const).map((env) => ({ env, count: r.found.filter((b) => b.environment === env).length }));

  return (
    <>
      <Link to={`/projects/${id}/releases`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Phát hành
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {r.version}
          {r.name ? ` — ${r.name}` : ''}
        </h1>
        <p className="text-sm text-slate-500">{r.status === 'released' ? `Đã phát hành ${formatDate(r.releasedAt)}` : 'Đang chuẩn bị'}</p>
        {r.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-slate-600">{r.description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Nội dung phiên bản (${r.fixes.length})`}>
            <TaskList tasks={r.fixes} empty="Chưa có việc nào gắn vào phiên bản này. Chọn phiên bản khi tạo/sửa công việc." />
          </Card>
          <Card title={`Bug phát hiện ở phiên bản này (${r.found.length})`}>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
              {byEnv.map((e) => (
                <span key={e.env} className="rounded-full border border-white/[0.14] px-2.5 py-0.5">
                  {ENVIRONMENT_LABEL[e.env]}: {e.count}
                </span>
              ))}
            </div>
            <TaskList tasks={r.found} empty="Chưa có bug nào được ghi nhận ở phiên bản này." />
          </Card>
        </div>
        <Card title="Release notes" action={<Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>Sao chép</Button>}>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{r.notes}</pre>
        </Card>
      </div>
    </>
  );
}
