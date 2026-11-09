import clsx from 'clsx';
import { ArrowLeft, Bug, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/States';
import { StatusBadge } from '../components/ui/Badges';
import { useToast } from '../components/ui/useToast';
import { useCloseTestRun, useExecuteResult, useTestRun } from '../hooks/useQa';
import { getErrorMessage } from '../lib/api';
import { ENVIRONMENT_LABEL, RESULT_META } from '../lib/constants';
import { inputClass } from '../lib/styles';
import type { TestResultStatus, TestResultView } from '../types/api';

const ACTIONS: { status: TestResultStatus; label: string }[] = [
  { status: 'passed', label: 'Đạt' },
  { status: 'failed', label: 'Lỗi' },
  { status: 'blocked', label: 'Bị chặn' },
  { status: 'skipped', label: 'Bỏ qua' },
];

function ResultRow({ result, locked }: { result: TestResultView; locked: boolean }) {
  const toast = useToast();
  const execute = useExecuteResult();
  const [note, setNote] = useState(result.note ?? '');
  const [open, setOpen] = useState(false);

  const run = async (status: TestResultStatus) => {
    try {
      const out = await execute.mutateAsync({ id: result.id, status, note: note.trim() || null });
      toast.show(out.createdBug ? `Đã tạo Bug #${out.createdBug.id} từ test lỗi` : `Đã ghi: ${RESULT_META[status].label}`, 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-slate-900">{result.testCase.title}</p>
          {result.executedBy && <p className="text-xs text-slate-500">Bởi {result.executedBy.name}</p>}
        </button>
        <span className={clsx('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', RESULT_META[result.status].badge)}>{RESULT_META[result.status].label}</span>
        {result.bug && (
          <Link to={`/tasks/${result.bug.id}`} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-400" title={result.bug.title}>
            <Bug className="h-3.5 w-3.5" aria-hidden /> Bug #{result.bug.id} <StatusBadge status={result.bug.status} />
          </Link>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/[0.08] p-3 text-sm">
          {result.testCase.preconditions && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[1px] text-slate-500">Tiền điều kiện</p>
              <p className="whitespace-pre-line text-slate-700">{result.testCase.preconditions}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-[1px] text-slate-500">Các bước</p>
            <p className="whitespace-pre-line text-slate-700">{result.testCase.steps}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[1px] text-slate-500">Kết quả mong đợi</p>
            <p className="whitespace-pre-line text-slate-700">{result.testCase.expected}</p>
          </div>
          {!locked && (
            <>
              <input aria-label="Ghi chú kết quả thực tế" placeholder="Kết quả thực tế / ghi chú (dùng làm mô tả Bug nếu lỗi)" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} className={inputClass} />
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <Button key={a.status} size="sm" variant={a.status === 'failed' ? 'danger' : result.status === a.status ? 'primary' : 'secondary'} loading={execute.isPending} onClick={() => void run(a.status)}>
                    {a.label}
                  </Button>
                ))}
                {result.status !== 'untested' && (
                  <Button size="sm" variant="ghost" onClick={() => void run('untested')}>
                    Đặt lại
                  </Button>
                )}
              </div>
              {!result.bug && <p className="text-xs text-slate-500">Chọn "Lỗi" sẽ tự tạo Bug (kế thừa môi trường và phiên bản của đợt này).</p>}
            </>
          )}
          {locked && result.note && <p className="text-slate-600">Ghi chú: {result.note}</p>}
        </div>
      )}
    </li>
  );
}

export default function TestRunPage() {
  const { id, runId } = useParams();
  const toast = useToast();
  const query = useTestRun(Number(runId));
  const close = useCloseTestRun();
  const run = query.data;
  if (query.isLoading) return <PageLoader />;
  if (query.isError || !run) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const locked = run.status === 'closed';
  const pct = (n: number) => (run.total === 0 ? 0 : (n / run.total) * 100);

  return (
    <>
      <Link to={`/projects/${id}/qa`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Kiểm thử
      </Link>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{run.name}</h1>
          <p className="text-sm text-slate-500">
            {run.environment ? ENVIRONMENT_LABEL[run.environment] : 'Không chỉ định môi trường'}
            {run.release ? ` · ${run.release.version}` : ''} · {locked ? 'Đã đóng' : 'Đang chạy'}
          </p>
        </div>
        {!locked && (
          <Button
            variant="secondary"
            icon={<Lock className="h-4 w-4" />}
            loading={close.isPending}
            onClick={() => void close.mutateAsync(run.id).then(() => toast.show('Đã đóng đợt kiểm thử', 'success')).catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))}
          >
            Đóng đợt
          </Button>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-white/[0.08] bg-card p-4">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/[0.04]" role="img" aria-label={`Đạt ${run.counts.passed}, lỗi ${run.counts.failed}, chặn ${run.counts.blocked}, bỏ qua ${run.counts.skipped}, chưa chạy ${run.counts.untested}`}>
          <div style={{ width: `${pct(run.counts.passed)}%`, backgroundColor: '#10b981' }} />
          <div style={{ width: `${pct(run.counts.failed)}%`, backgroundColor: '#ef4444' }} />
          <div style={{ width: `${pct(run.counts.blocked)}%`, backgroundColor: '#f59e0b' }} />
          <div style={{ width: `${pct(run.counts.skipped)}%`, backgroundColor: '#38bdf8' }} />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums text-slate-600">
          <span>Đạt {run.counts.passed}</span>
          <span>Lỗi {run.counts.failed}</span>
          <span>Bị chặn {run.counts.blocked}</span>
          <span>Bỏ qua {run.counts.skipped}</span>
          <span>Chưa chạy {run.counts.untested}</span>
          {run.passRate !== null && <span className="font-medium text-slate-900">Tỉ lệ đạt {run.passRate}%</span>}
        </p>
      </div>

      <Card title={`Test case (${run.total})`}>
        <ul className="divide-y divide-slate-100">
          {run.results.map((r) => (
            <ResultRow key={r.id} result={r} locked={locked} />
          ))}
        </ul>
      </Card>
    </>
  );
}
