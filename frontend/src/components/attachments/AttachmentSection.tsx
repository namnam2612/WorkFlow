import clsx from 'clsx';
import { Paperclip, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDeleteAttachment, useTaskAttachments, useUploadAttachments } from '../../hooks/useAttachments';
import { getErrorMessage } from '../../lib/api';
import { formatBytes, MAX_FILES_PER_UPLOAD, MAX_UPLOAD_BYTES } from '../../lib/files';
import type { Attachment } from '../../types/api';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ErrorState, InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';
import { AttachmentActions } from './AttachmentActions';
import { FileIcon } from './FileIcon';
import { FilePreviewModal } from './FilePreviewModal';
import { Uploader } from './Uploader';

/** Khu vực "File đính kèm" trong chi tiết task: kéo thả/chọn file, tiến trình upload, danh sách file */
export function AttachmentSection({ taskId }: { taskId: number }) {
  const toast = useToast();
  const query = useTaskAttachments(taskId);
  const upload = useUploadAttachments(taskId);
  const remove = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);

  const send = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    setError(null);
    if (files.length > MAX_FILES_PER_UPLOAD) return setError(`Mỗi lần chỉ tải lên tối đa ${MAX_FILES_PER_UPLOAD} file`);
    const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) return setError(`"${tooBig.name}" vượt quá ${formatBytes(MAX_UPLOAD_BYTES)}`);
    try {
      await upload.mutateAsync(files);
      toast.show(files.length === 1 ? 'Đã đính kèm file' : `Đã đính kèm ${files.length} file`, 'success');
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
    <Card title={`File đính kèm (${items.length})`} action={<Paperclip className="h-4 w-4 text-slate-500" aria-hidden />}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) void send(e.dataTransfer.files);
        }}
        className={clsx(
          'rounded-2xl border border-dashed px-4 py-6 text-center transition-colors duration-300',
          dragging ? 'border-white/50 bg-white/[0.06]' : 'border-white/[0.14] hover:border-white/30',
        )}
      >
        <input ref={inputRef} type="file" multiple className="sr-only" aria-label="Chọn file đính kèm" onChange={(e) => {
          if (e.target.files) void send(e.target.files);
          e.target.value = '';
        }} />
        <UploadCloud className="mx-auto h-6 w-6 text-slate-500" aria-hidden />
        <p className="mt-2 text-sm text-slate-700">
          Kéo thả file vào đây hoặc{' '}
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="link-underline !normal-case !tracking-normal text-white disabled:opacity-50">
            bấm để chọn
          </button>
        </p>
        <p className="mt-1 text-xs text-slate-500">Tối đa {MAX_FILES_PER_UPLOAD} file mỗi lần, mỗi file {formatBytes(MAX_UPLOAD_BYTES)}. Không nhận file thực thi (.exe, .sh, .bat...).</p>
        {uploading && (
          <div className="mx-auto mt-3 max-w-sm" role="progressbar" aria-valuenow={upload.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến trình tải lên">
            <div className="h-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${upload.progress ?? 0}%` }} />
            </div>
            <p className="tabular mt-1 text-xs text-slate-500">Đang tải lên... {upload.progress ?? 0}%</p>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-3">
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
