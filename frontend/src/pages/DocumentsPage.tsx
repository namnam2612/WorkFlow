import clsx from 'clsx';
import { LayoutGrid, Rows3, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AttachmentActions } from '../components/attachments/AttachmentActions';
import { FileIcon } from '../components/attachments/FileIcon';
import { FilePreviewModal } from '../components/attachments/FilePreviewModal';
import { Thumbnail } from '../components/attachments/Thumbnail';
import { Uploader } from '../components/attachments/Uploader';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { downloadAttachment, useAttachmentList, useDeleteAttachment } from '../hooks/useAttachments';
import { useProjects } from '../hooks/useProjects';
import { useUsers } from '../hooks/useUsers';
import { getErrorMessage } from '../lib/api';
import { CATEGORIES, CATEGORY_LABEL, formatBytes } from '../lib/files';
import { formatDateTime, vnDateInputToEndOfDayIso, vnDateInputToIso } from '../lib/format';
import { inputClass } from '../lib/styles';
import type { Attachment, AttachmentFilters, FileCategory } from '../types/api';

const SORT_FIELDS = ['createdAt', 'name', 'size'] as const;
const SORT_LABEL: Record<(typeof SORT_FIELDS)[number], string> = { createdAt: 'Ngày gửi', name: 'Tên file', size: 'Dung lượng' };
const VIEW_KEY = 'taskflow.documentsView';
type View = 'table' | 'grid';

function asEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
}

export default function DocumentsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [view, setViewState] = useState<View>(readView);
  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  const remove = useDeleteAttachment();

  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);
  const searchTimer = useRef<number | undefined>(undefined);
  const projectId = params.get('projectId') ?? '';
  const uploaderId = params.get('uploaderId') ?? '';
  const type = asEnum<FileCategory>(params.get('type'), CATEGORIES);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sortBy = asEnum(params.get('sortBy'), SORT_FIELDS) ?? 'createdAt';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = view === 'grid' ? 24 : 15;

  const setView = (next: View) => {
    setViewState(next);
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.delete('page');
      return copy;
    }, { replace: true });
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // bỏ qua: chỉ mất ghi nhớ kiểu xem
    }
  };

  const update = (changes: Record<string, string | null>, resetPage = true) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => update({ q: value.trim() }), 350);
  };
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const projectsQuery = useProjects();
  const usersQuery = useUsers({});
  const filters: AttachmentFilters = {
    search: q || undefined,
    projectId: projectId ? Number(projectId) : undefined,
    uploaderId: uploaderId ? Number(uploaderId) : undefined,
    type,
    from: from ? (vnDateInputToIso(from) ?? undefined) : undefined,
    to: vnDateInputToEndOfDayIso(to),
    sortBy,
    order,
    page,
    pageSize,
  };
  const listQuery = useAttachmentList(filters);
  const hasFilters = Boolean(q || projectId || uploaderId || type || from || to);

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchInput('');
    setParams({}, { replace: true });
  };

  const toggleSort = (key: (typeof SORT_FIELDS)[number]) => {
    if (key === sortBy) update({ order: order === 'asc' ? 'desc' : 'asc' }, false);
    else update({ sortBy: key, order: key === 'name' ? 'asc' : 'desc' }, false);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting);
      toast.show('Đã xóa file', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const open = (file: Attachment) => {
    if (file.previewable) setPreviewing(file);
    else void downloadAttachment(file).catch((error: unknown) => toast.show(getErrorMessage(error), 'error'));
  };

  const data = listQuery.data;
  const sortHeader = (key: (typeof SORT_FIELDS)[number], label: string, className?: string) => (
    <th scope="col" aria-sort={sortBy === key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'} className={clsx('px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[1px] text-slate-500', className)}>
      <button type="button" onClick={() => toggleSort(key)} className={clsx('inline-flex items-center gap-1 uppercase hover:text-white', sortBy === key && 'text-white')}>
        {label}
        {sortBy === key && <span aria-hidden>{order === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
  const plainHeader = (label: string, className?: string) => (
    <th scope="col" className={clsx('px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[1px] text-slate-500', className)}>
      {label}
    </th>
  );

  return (
    <>
      <PageHeader
        title="Kho tài liệu"
        description="Toàn bộ file đính kèm của mọi công việc. Tìm file mà không cần nhớ nó nằm ở task nào."
        actions={
          <div className="inline-flex gap-1" role="group" aria-label="Kiểu hiển thị">
            <Button variant={view === 'table' ? 'primary' : 'secondary'} size="sm" icon={<Rows3 className="h-4 w-4" />} aria-pressed={view === 'table'} onClick={() => setView('table')}>
              Bảng
            </Button>
            <Button variant={view === 'grid' ? 'primary' : 'secondary'} size="sm" icon={<LayoutGrid className="h-4 w-4" />} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
              Lưới
            </Button>
          </div>
        }
      />

      <div className="mb-4 space-y-3 rounded-2xl border border-white/[0.08] bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input value={searchInput} onChange={(e) => onSearchChange(e.target.value)} placeholder="Tìm theo tên file..." className={`${inputClass} pl-9`} aria-label="Tìm file" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select aria-label="Dự án" value={projectId} onChange={(e) => update({ projectId: e.target.value })} className={inputClass}>
            <option value="">Tất cả dự án</option>
            {projectsQuery.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Người gửi" value={uploaderId} onChange={(e) => update({ uploaderId: e.target.value })} className={inputClass}>
            <option value="">Tất cả người gửi</option>
            {usersQuery.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select aria-label="Loại file" value={type ?? ''} onChange={(e) => update({ type: e.target.value })} className={inputClass}>
            <option value="">Mọi loại file</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select aria-label="Sắp xếp theo" value={sortBy} onChange={(e) => update({ sortBy: e.target.value }, false)} className={inputClass}>
              {SORT_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {SORT_LABEL[f]}
                </option>
              ))}
            </select>
            <select aria-label="Thứ tự" value={order} onChange={(e) => update({ order: e.target.value }, false)} className={inputClass}>
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Gửi từ ngày
            <input type="date" value={from} onChange={(e) => update({ from: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            đến ngày
            <input type="date" value={to} onChange={(e) => update({ to: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={clearFilters} className="mb-1 ml-auto">
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {listQuery.isLoading ? (
        <PageLoader />
      ) : listQuery.isError || !data ? (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Không có file phù hợp bộ lọc' : 'Chưa có file nào'}
          description={hasFilters ? 'Thử nới lỏng hoặc xóa bộ lọc.' : 'Hãy đính kèm file vào một công việc, file sẽ xuất hiện ở đây.'}
          action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Xóa bộ lọc</Button> : undefined}
        />
      ) : (
        <div className={listQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          {view === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-card">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-white/[0.02]">
                  <tr>
                    {sortHeader('name', 'Tên file')}
                    {plainHeader('Task')}
                    {plainHeader('Dự án')}
                    {plainHeader('Người gửi')}
                    {sortHeader('size', 'Dung lượng', 'whitespace-nowrap')}
                    {sortHeader('createdAt', 'Thời gian gửi')}
                    {plainHeader('Thao tác', 'text-right')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-50">
                      <td className="max-w-[12rem] px-3 py-3">
                        <div className="flex items-center gap-3">
                          <FileIcon mime={file.mimeType} className="h-9 w-9" />
                          <button type="button" onClick={() => open(file)} title={file.originalName} className="truncate text-left text-sm font-medium text-slate-900 hover:text-white/70">
                            {file.originalName}
                          </button>
                        </div>
                      </td>
                      <td className="max-w-[10rem] px-3 py-3">
                        <Link to={`/tasks/${file.task.id}`} title={file.task.title} className="block truncate text-sm text-slate-800 underline decoration-white/20 underline-offset-4 hover:decoration-white">
                          {file.task.title}
                        </Link>
                      </td>
                      <td className="max-w-[8rem] px-3 py-3">
                        <Link to={`/projects/${file.project.id}`} className="block truncate text-sm text-slate-600 hover:text-white">
                          {file.project.name}
                        </Link>
                      </td>
                      <td className="max-w-[12rem] px-3 py-3">
                        <Uploader attachment={file} />
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-right text-sm text-slate-600">{formatBytes(file.size)}</td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-sm text-slate-600">{formatDateTime(file.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          <AttachmentActions attachment={file} onPreview={setPreviewing} onDelete={setDeleting} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((file) => (
                <li key={file.id} className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-card p-3 transition-colors duration-300 hover:border-white/20">
                  <button type="button" onClick={() => open(file)} aria-label={file.previewable ? `Xem trước ${file.originalName}` : `Tải về ${file.originalName}`}>
                    <Thumbnail attachment={file} />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <Link to={`/tasks/${file.task.id}`} title={file.task.title} className="block truncate text-xs text-slate-600 underline decoration-white/20 underline-offset-4 hover:decoration-white">
                      {file.task.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{file.project.name}</p>
                  </div>
                  <div className="mt-auto space-y-2 border-t border-white/[0.08] pt-3">
                    <Uploader attachment={file} />
                    <div className="flex items-center justify-between gap-2">
                      <p className="tabular text-xs text-slate-500">
                        {formatBytes(file.size)} · {formatDateTime(file.createdAt)}
                      </p>
                      <AttachmentActions attachment={file} onPreview={setPreviewing} onDelete={setDeleting} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={(p) => update({ page: String(p) }, false)} />
        </div>
      )}

      <FilePreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Xóa file đính kèm"
        message={`Xóa "${deleting?.originalName ?? ''}"? File sẽ bị xóa vĩnh viễn và không thể khôi phục.`}
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
