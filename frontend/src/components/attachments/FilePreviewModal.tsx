import { Download } from 'lucide-react';
import { downloadAttachment, usePreviewUrl } from '../../hooks/useAttachments';
import { getErrorMessage } from '../../lib/api';
import { formatBytes } from '../../lib/files';
import type { Attachment } from '../../types/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PageLoader } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Xem trực tiếp ảnh và PDF trong modal (không cần tải về) */
export function FilePreviewModal({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const toast = useToast();
  const preview = usePreviewUrl(attachment?.id ?? null, attachment?.previewable === true);
  if (!attachment) return null;
  const isPdf = attachment.mimeType === 'application/pdf';

  const download = () => void downloadAttachment(attachment).catch((error: unknown) => toast.show(getErrorMessage(error), 'error'));

  return (
    <Modal open title={attachment.originalName} onClose={onClose} size="xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {formatBytes(attachment.size)} · Người gửi: {attachment.uploader.name}
        </span>
        <div className="flex items-center gap-2">
          {isPdf && preview.url && (
            // PDF trong khung có thể không hiện trên một số trình duyệt di động: cho mở ở tab mới
            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="link-underline !normal-case !tracking-normal text-slate-700">
              Mở trong tab mới
            </a>
          )}
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={download}>
            Tải về
          </Button>
        </div>
      </div>
      {preview.loading ? (
        <PageLoader />
      ) : preview.error || !preview.url ? (
        <p className="py-10 text-center text-sm text-red-600">{preview.error ? getErrorMessage(preview.error) : 'Không xem trước được file này'}</p>
      ) : isPdf ? (
        <iframe src={preview.url} title={attachment.originalName} className="h-[70vh] w-full rounded-xl border border-white/[0.08] bg-white" />
      ) : (
        <div className="flex max-h-[70vh] justify-center overflow-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <img src={preview.url} alt={attachment.originalName} className="max-h-[66vh] max-w-full object-contain" />
        </div>
      )}
    </Modal>
  );
}
