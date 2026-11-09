import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadAttachment, useDeleteAttachment } from '../../hooks/useAttachments';
import { useFileSearch } from '../../hooks/useFolders';
import { getErrorMessage } from '../../lib/api';
import { formatBytes } from '../../lib/files';
import { formatDateTime } from '../../lib/format';
import type { Attachment } from '../../types/api';
import { AttachmentActions } from '../attachments/AttachmentActions';
import { FileIcon } from '../attachments/FileIcon';
import { FilePreviewModal } from '../attachments/FilePreviewModal';
import { Uploader } from '../attachments/Uploader';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Pagination } from '../ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Đường dẫn đầy đủ của file: "Dự án / Task" hoặc "Dự án / File chung"; bấm từng phần để nhảy tới thư mục đó */
export function FilePath({ file }: { file: Attachment }) {
  const link = 'truncate underline decoration-white/20 underline-offset-4 hover:text-white hover:decoration-white';
  return (
    <p className="flex min-w-0 items-center gap-1 text-xs text-slate-600" aria-label="Đường dẫn">
      <Link to={`/files/projects/${file.project.id}`} title={file.project.name} className={link}>
        {file.project.name}
      </Link>
      <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
      {file.task ? (
        <Link to={`/files/tasks/${file.task.id}`} title={file.task.title} className={link}>
          {file.task.title}
        </Link>
      ) : (
        <Link to={`/files/projects/${file.project.id}/common`} className={link}>
          File chung của dự án
        </Link>
      )}
    </p>
  );
}

/** Kết quả tìm file theo tên trên TOÀN kho (không phụ thuộc đang ở cấp nào) */
export function FileSearchResults({ q, page, onPage }: { q: string; page: number; onPage: (page: number) => void }) {
  const toast = useToast();
  const query = useFileSearch(q, page);
  const remove = useDeleteAttachment();
  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);

  const open = (file: Attachment) => {
    if (file.previewable) setPreviewing(file);
    else void downloadAttachment(file).catch((e: unknown) => toast.show(getErrorMessage(e), 'error'));
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting);
      toast.show('Đã xóa file', 'success');
    } catch (e) {
      toast.show(getErrorMessage(e), 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <section aria-label="Kết quả tìm kiếm">
      <p className="mb-3 text-sm text-slate-600">
        {data.total === 0 ? 'Không tìm thấy file nào' : `${data.total} file`} khớp với <strong className="text-slate-900">&ldquo;{q}&rdquo;</strong> trên toàn kho
      </p>
      {data.total === 0 ? (
        <EmptyState title="Không có file phù hợp" description="Thử từ khóa khác hoặc xóa ô tìm kiếm để quay lại thư mục." />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-card">
            {data.items.map((file) => (
              <Fragment key={file.id}>
                <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <FileIcon mime={file.mimeType} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => open(file)} title={file.originalName} className="block max-w-full truncate text-left text-sm font-medium text-slate-900 hover:text-white/70">
                      {file.originalName}
                    </button>
                    <FilePath file={file} />
                  </div>
                  <div className="hidden w-48 shrink-0 md:block">
                    <Uploader attachment={file} />
                  </div>
                  <p className="tabular hidden w-40 shrink-0 text-right text-xs text-slate-500 sm:block">
                    {formatBytes(file.size)}
                    <br />
                    {formatDateTime(file.createdAt)}
                  </p>
                  <AttachmentActions attachment={file} onPreview={setPreviewing} onDelete={setDeleting} />
                </li>
              </Fragment>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={onPage} />
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
    </section>
  );
}
