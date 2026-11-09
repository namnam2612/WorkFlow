import clsx from 'clsx';
import { ArrowLeft, Plus, Rocket } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Field } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, InlineError, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useProject } from '../hooks/useProjects';
import { useCreateRelease, usePublishRelease, useReleases } from '../hooks/useReleases';
import { getErrorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { canManageProject } from '../lib/permissions';
import { inputClass } from '../lib/styles';
import type { Release } from '../types/api';

function CreateReleaseModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateRelease(projectId);
  const [version, setVersion] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({ version: version.trim(), name: name.trim() || null, description: description.trim() || null });
      toast.show('Đã tạo phiên bản', 'success');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="Tạo phiên bản">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <InlineError message={error} />
        <Field label="Số phiên bản" htmlFor="rel-version" hint="Dạng semver: 1.1.0, v2.0.0-rc.1 (tự thêm chữ v)">
          <input id="rel-version" autoFocus className={inputClass} value={version} maxLength={40} onChange={(e) => setVersion(e.target.value)} placeholder="1.1.0" />
        </Field>
        <Field label="Tên (tùy chọn)" htmlFor="rel-name">
          <input id="rel-name" className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mô tả" htmlFor="rel-desc">
          <textarea id="rel-desc" rows={3} className={inputClass} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending}>
            Tạo
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ReleasesPage() {
  const projectId = Number(useParams().id);
  const { user } = useAuth();
  const toast = useToast();
  const projectQuery = useProject(projectId);
  const query = useReleases(projectId);
  const publish = usePublishRelease();
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ release: Release; force: boolean } | null>(null);
  const canManage = canManageProject(user, projectQuery.data);

  if (projectQuery.isLoading || query.isLoading) return <PageLoader />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const project = projectQuery.data;

  const doPublish = async (release: Release, force: boolean) => {
    try {
      await publish.mutateAsync({ id: release.id, force });
      toast.show(`Đã phát hành ${release.version}`, 'success');
      setConfirm(null);
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
      if (!force && release.stats.items > release.stats.doneItems) setConfirm({ release, force: true });
      else setConfirm(null);
    }
  };

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Phát hành</h1>
          <p className="text-sm text-slate-500">Đánh tag phiên bản, gom việc và Bug đã sửa, tạo release notes</p>
        </div>
        {canManage && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Tạo phiên bản
          </Button>
        )}
      </div>

      {query.data.length === 0 ? (
        <EmptyState title="Chưa có phiên bản nào" description="Tạo phiên bản (vd v1.0.0) rồi gắn công việc và Bug vào đó khi tạo/sửa." action={canManage ? <Button onClick={() => setCreating(true)}>Tạo phiên bản</Button> : undefined} />
      ) : (
        <div className="space-y-4">
          {query.data.map((r) => (
            <Card key={r.id} title="">
              <div className="flex flex-wrap items-center gap-3">
                <Rocket className={clsx('h-5 w-5 shrink-0', r.status === 'released' ? 'text-emerald-500' : 'text-slate-400')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${project.id}/releases/${r.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-700">
                    {r.version}
                    {r.name ? ` — ${r.name}` : ''}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {r.status === 'released' ? `Phát hành ${formatDate(r.releasedAt)}` : 'Đang chuẩn bị'} · {r.stats.doneItems}/{r.stats.items} việc xong · {r.stats.bugsFixed} bug đã sửa
                    {r.stats.openBugsFound > 0 ? ` · ${r.stats.openBugsFound} bug phát hiện còn mở` : ''}
                  </p>
                </div>
                <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', r.status === 'released' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200')}>
                  {r.status === 'released' ? 'Đã phát hành' : 'Kế hoạch'}
                </span>
                {canManage && r.status === 'planned' && (
                  <Button size="sm" icon={<Rocket className="h-4 w-4" />} onClick={() => void doPublish(r, false)}>
                    Phát hành
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {creating && <CreateReleaseModal projectId={project.id} onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={confirm !== null}
        title="Còn việc chưa hoàn thành"
        message={`Phiên bản ${confirm?.release.version ?? ''} còn ${(confirm?.release.stats.items ?? 0) - (confirm?.release.stats.doneItems ?? 0)} việc chưa xong. Vẫn phát hành?`}
        loading={publish.isPending}
        onConfirm={() => confirm && void doPublish(confirm.release, true)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
