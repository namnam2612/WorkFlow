import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useDeleteAttachment, useScopeAttachments, useUploadAttachments, type AttachmentScope } from '../../hooks/useAttachments';
import { getErrorMessage } from '../../lib/api';
import { formatBytes, validateIncomingFiles } from '../../lib/files';
import type { Attachment } from '../../types/api';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ErrorState, InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';
import { AttachmentActions } from './AttachmentActions';
import { FileDropZone } from './FileDropZone';
import { FileIcon } from './FileIcon';
import { FilePreviewModal } from './FilePreviewModal';
import { Uploader } from './Uploader';

interface AttachmentSectionProps {
  scope: AttachmentScope;
  /** Người xem có được tải file lên không (file dự án: chỉ leader/admin; file task: mọi thành viên) */
  canUpload?: boolean;
  title?: string;
}

/** Khu vực "File đính kèm" của task hoặc dự án: kéo thả/chọn file, tiến trình upload, danh sách file */
export function AttachmentSection({ scope, canUpload = true, title = 'File đính kèm' }: AttachmentSectionProps) {
  const toast = useToast();
  const query = useScopeAttachments(scope);
  const upload = useUploadAttachments(scope);
  const remove = useDeleteAttachment();
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);

  const send = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    setError(null);
    const { accepted, errors } = validateIncomingFiles([], incoming);
    if (errors.length > 0) setError(errors.join('\n'));
    if (accepted.length === 0) return;
    try {
      await upload.mutateAsync(accepted);
      toast.show(accepted.length === 1 ? 'Đã đính kèm file' : `Đã đính kèm ${accepted.length} file`, 'success');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting);
      toast.show('Đã xóa file', 'success');
    } catch (err) {
      toast.show(getErrorMessage(err), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const items = query.data ?? [];
  const uploading = upload.isPending;

  return (
    <Card title={`${title} (${items.length})`} action={<Paperclip className="h-4 w-4 text-slate-500" aria-hidden />}>
      {canUpload ? (
        <FileDropZone onFiles={(files) => void send(files)} disabled={uploading}>
          {uploading && (
            <div className="mx-auto mt-3 max-w-sm" role="progressbar" aria-valuenow={upload.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến trình tải lên">
              <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${upload.progress ?? 0}%` }} />
              </div>
              <p className="tabular mt-1 text-xs text-slate-500">Đang tải lên... {upload.progress ?? 0}%</p>
            </div>
          )}
        </FileDropZone>
      ) : (
        <p className="text-xs text-slate-500">Chỉ trưởng nhóm của dự án và quản trị viên mới đính kèm được file vào dự án. Bạn có thể xem và tải về.</p>
      )}
      {error && (
        <div className="mt-3 whitespace-pre-line">
          <InlineError message={error} />
        </div>
      )}

      {query.isError ? (
        <div className="mt-4">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-center text-sm text-slate-500">Chưa có file đính kèm.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
              <FileIcon mime={file.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <div className="min-w-0 sm:w-56 sm:shrink-0">
                <p className="text-[11px] uppercase tracking-[1px] text-slate-500">Người gửi</p>
                <Uploader attachment={file} showTime />
              </div>
              <div className="flex shrink-0 justify-end sm:w-[7.5rem]">
                <AttachmentActions attachment={file} onPreview={setPreviewing} onDelete={setDeleting} />
              </div>
            </li>
          ))}
        </ul>
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
    </Card>
  );
}
