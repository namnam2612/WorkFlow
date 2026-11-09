import { Download } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { downloadAttachment, usePreviewBlob } from '../../hooks/useAttachments';
import { getErrorMessage } from '../../lib/api';
import { formatBytes, MAX_OFFICE_PREVIEW_BYTES, previewKind } from '../../lib/files';
import type { Attachment } from '../../types/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PageLoader } from '../ui/States';
import { useToast } from '../ui/useToast';

// Mỗi loại tải riêng (mammoth / read-excel-file khá nặng) và chỉ khi người dùng mở xem
const TextPreview = lazy(() => import('./previews/TextPreview'));
const CsvPreview = lazy(() => import('./previews/CsvPreview'));
const DocxPreview = lazy(() => import('./previews/DocxPreview'));
const XlsxPreview = lazy(() => import('./previews/XlsxPreview'));

/** Blob URL cho ảnh/PDF; tự giải phóng khi đổi file hoặc đóng */
function useObjectUrl(blob: Blob | null): string | null {
  const [state, setState] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setState({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return state && state.blob === blob ? state.url : null;
}

/** Xem trực tiếp trên web: ảnh, PDF, văn bản/Markdown, CSV, Word (.docx), Excel (.xlsx) — không cần tải về */
export function FilePreviewModal({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const toast = useToast();
  const kind = attachment ? previewKind(attachment.mimeType) : null;
  const tooBig = attachment !== null && (kind === 'docx' || kind === 'xlsx') && attachment.size > MAX_OFFICE_PREVIEW_BYTES;
  const preview = usePreviewBlob(attachment?.id ?? null, attachment?.previewable === true && kind !== null && !tooBig);
  const url = useObjectUrl(kind === 'image' || kind === 'pdf' ? preview.blob : null);
  if (!attachment) return null;

  const download = () => void downloadAttachment(attachment).catch((error: unknown) => toast.show(getErrorMessage(error), 'error'));
  const message = tooBig
    ? `File lớn hơn ${formatBytes(MAX_OFFICE_PREVIEW_BYTES)} nên không xem nhanh được, hãy tải về.`
    : preview.error
      ? getErrorMessage(preview.error)
      : kind === null
        ? 'Không xem trước được file này'
        : null;

  let body: React.ReactNode;
  if (message) body = <p className="py-10 text-center text-sm text-red-600">{message}</p>;
  else if (preview.loading || !preview.blob) body = <PageLoader />;
  else if (kind === 'pdf') body = url ? <iframe src={url} title={attachment.originalName} className="h-[70vh] w-full rounded-xl border border-white/[0.08] bg-white" /> : <PageLoader />;
  else if (kind === 'image')
    body = url ? (
      <div className="flex max-h-[70vh] justify-center overflow-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
        <img src={url} alt={attachment.originalName} className="max-h-[66vh] max-w-full object-contain" />
      </div>
    ) : (
      <PageLoader />
    );
  else
    body = (
      <Suspense fallback={<PageLoader />}>
        {kind === 'text' && <TextPreview blob={preview.blob} />}
        {kind === 'csv' && <CsvPreview blob={preview.blob} />}
        {kind === 'docx' && <DocxPreview blob={preview.blob} />}
        {kind === 'xlsx' && <XlsxPreview blob={preview.blob} />}
      </Suspense>
    );

  return (
    <Modal open title={attachment.originalName} onClose={onClose} size="xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {formatBytes(attachment.size)} · Người gửi: {attachment.uploader.name}
        </span>
        <div className="flex items-center gap-2">
          {kind === 'pdf' && url && (
            // PDF trong khung có thể không hiện trên một số trình duyệt di động: cho mở ở tab mới
            <a href={url} target="_blank" rel="noopener noreferrer" className="link-underline !normal-case !tracking-normal text-slate-700">
              Mở trong tab mới
            </a>
          )}
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={download}>
            Tải về
          </Button>
        </div>
      </div>
      {body}
    </Modal>
  );
}
