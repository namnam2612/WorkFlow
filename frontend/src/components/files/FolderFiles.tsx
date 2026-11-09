import { useState, type ReactNode } from 'react';
import { downloadAttachment, useDeleteAttachment } from '../../hooks/useAttachments';
import type { ViewMode } from '../../hooks/useViewMode';
import { getErrorMessage } from '../../lib/api';
import { formatBytes } from '../../lib/files';
import { formatDateTime } from '../../lib/format';
import type { Attachment, Paginated } from '../../types/api';
import { AttachmentActions } from '../attachments/AttachmentActions';
import { FileIcon } from '../attachments/FileIcon';
import { FilePreviewModal } from '../attachments/FilePreviewModal';
import { Uploader } from '../attachments/Uploader';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Pagination } from '../ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../ui/States';
import { useToast } from '../ui/useToast';
import { FileCard } from './FileCard';

interface FolderFilesProps {
  data: Paginated<Attachment> | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isPlaceholder: boolean;
  view: ViewMode;
  onPage: (page: number) => void;
  emptyTitle: string;
  emptyDescription?: string;
  /** Nút trong trạng thái rỗng (vd "Tải lên file") */
  emptyAction?: ReactNode;
}

/** Các file trong một thư mục (file chung của dự án / một task): lưới hoặc bảng, xem trước, tải về, xóa theo quyền, phân trang */
export function FolderFiles({ data, isLoading, error, onRetry, isPlaceholder, view, onPage, emptyTitle, emptyDescription, emptyAction }: FolderFilesProps) {
  const toast = useToast();
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

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} onRetry={onRetry} />;
  if (data.total === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  return (
    <div className={isPlaceholder ? 'opacity-60 transition-opacity' : ''}>
      {view === 'grid' ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((file) => (
            <FileCard key={file.id} file={file} showOwner={false} onOpen={open} onPreview={setPreviewing} onDelete={setDeleting} />
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-card">
          <table className="min-w-full">
            <thead className="bg-white/[0.02]">
              <tr className="text-left text-[11px] font-medium uppercase tracking-[1px] text-slate-500">
                <th scope="col" className="px-3 py-3">
                  Tên file
                </th>
                <th scope="col" className="px-3 py-3">
                  Người gửi
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Dung lượng
                </th>
                <th scope="col" className="px-3 py-3">
                  Thời gian gửi
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((file) => (
                <tr key={file.id} className="border-t border-white/[0.06] hover:bg-slate-50">
                  <td className="max-w-[18rem] px-3 py-3">
                    <div className="flex items-center gap-3">
                      <FileIcon mime={file.mimeType} className="h-9 w-9" />
                      <button type="button" onClick={() => open(file)} title={file.originalName} className="truncate text-left text-sm font-medium text-slate-900 hover:text-white/70">
                        {file.originalName}
                      </button>
                    </div>
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
      )}
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={onPage} />

      <FilePreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Xóa file đính kèm"
        message={`Xóa "${deleting?.originalName ?? ''}"? File sẽ bị xóa vĩnh viễn và không thể khôi phục.`}
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
