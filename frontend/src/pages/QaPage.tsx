import clsx from 'clsx';
import { ArchiveRestore, ArrowLeft, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TestCaseFormModal } from '../components/qa/TestCaseFormModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Field } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, InlineError, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { PriorityBadge } from '../components/ui/Badges';
import { useProject } from '../hooks/useProjects';
import { useCreateTestRun, useDeleteTestCase, useTestCases, useTestRuns, useUpdateTestCase } from '../hooks/useQa';
import { useReleases } from '../hooks/useReleases';
import { getErrorMessage } from '../lib/api';
import { ENVIRONMENT_LABEL, ENVIRONMENTS } from '../lib/constants';
import { formatDate } from '../lib/format';
import { chipClass, inputClass } from '../lib/styles';
import type { Environment, TestCase } from '../types/api';

function NewRunModal({ projectId, cases, onClose }: { projectId: number; cases: TestCase[]; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateTestRun(projectId);
  const releases = useReleases(projectId);
  const [name, setName] = useState('');
  const [env, setEnv] = useState<Environment | ''>('');
  const [releaseId, setReleaseId] = useState('');
  const [picked, setPicked] = useState<number[]>(cases.map((c) => c.id));
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Vui lòng đặt tên cho đợt kiểm thử');
    if (picked.length === 0) return setError('Hãy chọn ít nhất một test case');
    try {
      const run = await create.mutateAsync({ name: name.trim(), environment: env || null, releaseId: releaseId ? Number(releaseId) : null, testCaseIds: picked });
      toast.show('Đã tạo đợt kiểm thử', 'success');
      navigate(`/projects/${projectId}/qa/runs/${(run as { id: number }).id}`);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title="Tạo đợt kiểm thử" size="lg">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <InlineError message={error} />
        <Field label="Tên đợt" htmlFor="run-name">
          <input id="run-name" autoFocus className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="VD: Regression v1.1.0" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Môi trường" htmlFor="run-env">
            <select id="run-env" className={inputClass} value={env} onChange={(e) => setEnv(e.target.value as Environment | '')}>
              <option value="">Không chỉ định</option>
              {ENVIRONMENTS.map((v) => (
                <option key={v} value={v}>
                  {ENVIRONMENT_LABEL[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phiên bản" htmlFor="run-release">
            <select id="run-release" className={inputClass} value={releaseId} onChange={(e) => setReleaseId(e.target.value)}>
              <option value="">Không chỉ định</option>
              {(releases.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.version}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 flex items-center justify-between text-sm text-slate-700">
            <span>Test case ({picked.length}/{cases.length})</span>
            <button type="button" className="text-xs text-slate-500 hover:text-white" onClick={() => setPicked(picked.length === cases.length ? [] : cases.map((c) => c.id))}>
              {picked.length === cases.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </p>
          <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {cases.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded border-slate-300" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{c.title}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending} icon={<Play className="h-4 w-4" />}>
            Bắt đầu kiểm thử
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function QaPage() {
  const projectId = Number(useParams().id);
  const toast = useToast();
  const projectQuery = useProject(projectId);
  const [tab, setTab] = useState<'cases' | 'runs'>('cases');
  const [showArchived, setShowArchived] = useState(false);
  const casesQuery = useTestCases(projectId, showArchived);
  const runsQuery = useTestRuns(projectId);
  const update = useUpdateTestCase();
  const remove = useDeleteTestCase();
  const [form, setForm] = useState<TestCase | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TestCase | null>(null);
  const [newRun, setNewRun] = useState(false);

  if (projectQuery.isLoading || casesQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (casesQuery.isError || !casesQuery.data) return <ErrorState error={casesQuery.error} onRetry={() => void casesQuery.refetch()} />;
  const project = projectQuery.data;
  const active = casesQuery.data.filter((c) => !c.archived);

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Kiểm thử (QA)</h1>
          <p className="text-sm text-slate-500">Viết test case, chạy theo từng đợt; test lỗi tự tạo Bug để dev xử lý</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm('new')}>
            Test case
          </Button>
          <Button icon={<Play className="h-4 w-4" />} disabled={active.length === 0} onClick={() => setNewRun(true)}>
            Chạy kiểm thử
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'cases'} className={chipClass(tab === 'cases')} onClick={() => setTab('cases')}>
          Test case ({active.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'runs'} className={chipClass(tab === 'runs')} onClick={() => setTab('runs')}>
          Đợt kiểm thử ({runsQuery.data?.length ?? 0})
        </button>
      </div>

      {tab === 'cases' ? (
        <Card
          title=""
          action={
            <button type="button" aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)} className={chipClass(showArchived)}>
              Hiện cả đã lưu trữ
            </button>
          }
        >
          {casesQuery.data.length === 0 ? (
            <EmptyState title="Chưa có test case" description="Viết test case đầu tiên: tiền điều kiện, các bước và kết quả mong đợi." action={<Button onClick={() => setForm('new')}>Tạo test case</Button>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {casesQuery.data.map((c) => (
                <li key={c.id} className={clsx('flex items-start gap-3 py-3', c.archived && 'opacity-50')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {c.title} {c.archived && <span className="text-xs text-slate-500">(đã lưu trữ)</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-slate-500">{c.steps}</p>
                  </div>
                  <PriorityBadge priority={c.priority} />
                  <button type="button" aria-label={`Sửa ${c.title}`} onClick={() => setForm(c)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-white">
                    <Pencil className="h-4 w-4" />
                  </button>
                  {c.archived ? (
                    <button type="button" aria-label={`Khôi phục ${c.title}`} onClick={() => void update.mutateAsync({ id: c.id, archived: false }).catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))} className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-white">
                      <ArchiveRestore className="h-4 w-4" />
                    </button>
                  ) : (
                    <button type="button" aria-label={`Xóa ${c.title}`} onClick={() => setDeleting(c)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : runsQuery.isLoading ? (
        <PageLoader />
      ) : (runsQuery.data ?? []).length === 0 ? (
        <EmptyState title="Chưa có đợt kiểm thử" description={"Bấm \"Chạy kiểm thử\" để tạo đợt đầu tiên từ các test case."} />
      ) : (
        <div className="space-y-3">
          {runsQuery.data?.map((r) => (
            <Card key={r.id} title="">
              <Link to={`/projects/${project.id}/qa/runs/${r.id}`} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(r.createdAt)}
                    {r.environment ? ` · ${ENVIRONMENT_LABEL[r.environment]}` : ''}
                    {r.release ? ` · ${r.release.version}` : ''} · {r.status === 'closed' ? 'Đã đóng' : 'Đang chạy'}
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums text-slate-600">
                  <p>
                    {r.executed}/{r.total} đã chạy {r.passRate !== null && `· ${r.passRate}% đạt`}
                  </p>
                  <p>
                    {r.counts.passed} đạt · {r.counts.failed} lỗi · {r.counts.blocked} chặn
                  </p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {form !== null && <TestCaseFormModal projectId={project.id} testCase={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {newRun && <NewRunModal projectId={project.id} cases={active} onClose={() => setNewRun(false)} />}
      <ConfirmDialog
        open={deleting !== null}
        title="Xóa test case"
        message={`Xóa "${deleting?.title ?? ''}"? Nếu test case đã có kết quả trong các đợt kiểm thử thì sẽ được lưu trữ để giữ lịch sử.`}
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          void remove
            .mutateAsync(deleting.id)
            .then((r) => toast.show(r.archived ? 'Đã lưu trữ test case' : 'Đã xóa test case', 'success'))
            .catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))
            .finally(() => setDeleting(null));
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
