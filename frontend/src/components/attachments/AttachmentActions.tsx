import { Download, Eye, Trash2 } from 'lucide-react';
import { downloadAttachment } from '../../hooks/useAttachments';
import { getErrorMessage } from '../../lib/api';
import type { Attachment } from '../../types/api';
import { Button } from '../ui/Button';
import { useToast } from '../ui/useToast';

interface AttachmentActionsProps {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
  onDelete: (attachment: Attachment) => void;
}

/** Xem trước (ảnh/PDF) · Tải về · Xóa (chỉ hiện khi có quyền) */
export function AttachmentActions({ attachment, onPreview, onDelete }: AttachmentActionsProps) {
  const toast = useToast();
  return (
    <div className="flex shrink-0 items-center gap-1">
      {attachment.previewable && (
        <Button variant="ghost" size="sm" aria-label={`Xem trước ${attachment.originalName}`} title="Xem trước" onClick={() => onPreview(attachment)}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Tải về ${attachment.originalName}`}
        title="Tải về"
        onClick={() => void downloadAttachment(attachment).catch((error: unknown) => toast.show(getErrorMessage(error), 'error'))}
      >
        <Download className="h-4 w-4" />
      </Button>
      {attachment.canDelete && (
        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" aria-label={`Xóa ${attachment.originalName}`} title="Xóa" onClick={() => onDelete(attachment)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
