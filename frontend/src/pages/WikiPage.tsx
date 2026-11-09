import clsx from 'clsx';
import { ArrowLeft, FilePlus2, History, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { MarkdownView } from '../components/wiki/MarkdownView';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Field } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, InlineError, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useProject } from '../hooks/useProjects';
import { useApiSpecTemplate, useCreateWikiPage, useDeleteWikiPage, useRestoreRevision, useUpdateWikiPage, useWikiPage, useWikiRevisions, useWikiTree } from '../hooks/useWiki';
import { getErrorMessage } from '../lib/api';
import { canManageProject } from '../lib/permissions';
import { formatDateTime } from '../lib/format';
import { inputClass } from '../lib/styles';
import type { WikiNode } from '../types/api';

function Tree({ nodes, parentId, depth, activeId, projectId }: { nodes: WikiNode[]; parentId: number | null; depth: number; activeId: number | undefined; projectId: number }) {
  const children = nodes.filter((n) => n.parentId === parentId);
  if (children.length === 0) return null;
  return (
    <ul>
      {children.map((n) => (
        <li key={n.id}>
          <Link
            to={`/projects/${projectId}/wiki/${n.id}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            className={clsx('block truncate rounded-lg py-1.5 pr-2 text-sm transition-colors', n.id === activeId ? 'bg-white/10 font-medium text-white' : 'text-slate-600 hover:bg-white/[0.05] hover:text-white')}
            title={n.title}
          >
            {n.title}
          </Link>
          <Tree nodes={nodes} parentId={n.id} depth={depth + 1} activeId={activeId} projectId={projectId} />
        </li>
      ))}
    </ul>
  );
}

function NewPageModal({ projectId, nodes, defaultParent, onClose }: { projectId: number; nodes: WikiNode[]; defaultParent?: number; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateWikiPage(projectId);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState(defaultParent ? String(defaultParent) : '');
  const [useTemplate, setUseTemplate] = useState(false);
  const template = useApiSpecTemplate(useTemplate);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề');
    try {
      const page = await create.mutateAsync({ title: title.trim(), parentId: parentId ? Number(parentId) : null, content: useTemplate ? (template.data?.content ?? '') : '' });
      navigate(`/projects/${projectId}/wiki/${page.id}`);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="Tạo trang">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <InlineError message={error} />
        <Field label="Tiêu đề" htmlFor="wiki-title">
          <input id="wiki-title" autoFocus className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Nằm trong trang" htmlFor="wiki-parent">
          <select id="wiki-parent" className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Gốc —</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Dùng mẫu tài liệu API (endpoint, yêu cầu, phản hồi, lỗi)
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending}>
            Tạo trang
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function WikiPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const pageId = params.pageId ? Number(params.pageId) : undefined;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const projectQuery = useProject(projectId);
  const treeQuery = useWikiTree(projectId);
  const pageQuery = useWikiPage(pageId);
  const update = useUpdateWikiPage(pageId ?? 0);
  const remove = useDeleteWikiPage();
  const restore = useRestoreRevision(pageId ?? 0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ title: string; content: string; baseUpdatedAt: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revisions = useWikiRevisions(pageId, showHistory);

  const nodes = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  if (projectQuery.isLoading || treeQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (treeQuery.isError) return <ErrorState error={treeQuery.error} onRetry={() => void treeQuery.refetch()} />;
  const project = projectQuery.data;
  const page = pageQuery.data;
  const canDelete = page !== undefined && (page.createdBy?.id === user?.id || canManageProject(user, project));

  const save = async () => {
    if (!editing || !page) return;
    setError(null);
    try {
      await update.mutateAsync({ title: editing.title.trim(), content: editing.content, expectedUpdatedAt: editing.baseUpdatedAt });
      setEditing(null);
      toast.show('Đã lưu trang', 'success');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Tài liệu</h1>
          <p className="text-sm text-slate-500">Viết tài liệu kỹ thuật, đặc tả API bằng Markdown; mọi thành viên dự án cùng soạn</p>
        </div>
        <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Tạo trang
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Cây tài liệu" className="rounded-2xl border border-white/[0.08] bg-card p-2 lg:sticky lg:top-4 lg:max-h-[75vh] lg:self-start lg:overflow-y-auto">
          {nodes.length === 0 ? <p className="p-3 text-sm text-slate-500">Chưa có trang nào.</p> : <Tree nodes={nodes} parentId={null} depth={0} activeId={pageId} projectId={project.id} />}
        </nav>

        <section className="min-w-0">
          {pageId === undefined ? (
            <EmptyState title={nodes.length === 0 ? 'Dự án chưa có tài liệu' : 'Chọn một trang ở bên trái'} description="Tạo trang đầu tiên để bắt đầu viết tài liệu kỹ thuật hoặc đặc tả API." action={<Button onClick={() => setCreating(true)}>Tạo trang</Button>} />
          ) : pageQuery.isLoading ? (
            <PageLoader />
          ) : pageQuery.isError || !page ? (
            <ErrorState error={pageQuery.error} onRetry={() => void pageQuery.refetch()} />
          ) : editing ? (
            <div className="space-y-3">
              <InlineError message={error} />
              <input aria-label="Tiêu đề trang" className={`${inputClass} text-lg font-semibold`} value={editing.title} maxLength={200} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <textarea aria-label="Nội dung Markdown" className={`${inputClass} min-h-[420px] font-mono text-[13px] leading-relaxed`} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} spellCheck={false} />
                <div className="min-h-[420px] overflow-auto rounded-[10px] border border-white/[0.08] p-4" aria-label="Xem trước">
                  <MarkdownView source={editing.content} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setEditing(null); setError(null); }}>
                  Hủy
                </Button>
                <Button loading={update.isPending} onClick={() => void save()}>
                  Lưu
                </Button>
              </div>
            </div>
          ) : (
            <article className="rounded-2xl border border-white/[0.08] bg-card p-5 sm:p-7">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-2xl font-bold tracking-tight text-slate-900">{page.title}</h2>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {page.updatedBy && <Avatar name={page.updatedBy.name} avatarUrl={page.updatedBy.avatarUrl} size="sm" />}
                    Cập nhật {formatDateTime(page.updatedAt)}
                    {page.updatedBy ? ` bởi ${page.updatedBy.name}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing({ title: page.title, content: page.content, baseUpdatedAt: page.updatedAt })}>
                    Sửa
                  </Button>
                  <Button variant="ghost" size="sm" icon={<History className="h-4 w-4" />} onClick={() => setShowHistory(true)}>
                    Lịch sử
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                      Xóa
                    </Button>
                  )}
                </div>
              </div>
              <MarkdownView source={page.content} />
            </article>
          )}
        </section>
      </div>

      {creating && <NewPageModal projectId={project.id} nodes={nodes} defaultParent={pageId} onClose={() => setCreating(false)} />}
      {showHistory && page && (
        <Modal open onClose={() => setShowHistory(false)} title={`Lịch sử: ${page.title}`} size="lg">
          {revisions.isLoading ? (
            <PageLoader />
          ) : (revisions.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có bản lưu cũ. Mỗi lần sửa, bản trước đó được lưu lại ở đây.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {revisions.data?.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(r.createdAt)}
                      {r.author ? ` · ${r.author.name}` : ''} · {r.content.length} ký tự
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={restore.isPending}
                    onClick={() => void restore.mutateAsync(r.id).then(() => { toast.show('Đã khôi phục bản này', 'success'); setShowHistory(false); }).catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))}
                  >
                    Khôi phục
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa trang"
        message={`Xóa "${page?.title ?? ''}"? Các trang con được chuyển lên cấp trên.`}
        loading={remove.isPending}
        onConfirm={() => {
          if (!page) return;
          void remove
            .mutateAsync(page.id)
            .then(() => { toast.show('Đã xóa trang', 'success'); navigate(`/projects/${project.id}/wiki`, { replace: true }); })
            .catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))
            .finally(() => setConfirmDelete(false));
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
