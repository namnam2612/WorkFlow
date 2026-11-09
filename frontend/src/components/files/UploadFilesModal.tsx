import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { attachmentPath, invalidateAttachmentRelated, type AttachmentScope } from '../../hooks/useAttachments';
import { useBatchUpload } from '../../hooks/useBatchUpload';
import { AttachmentPicker } from '../attachments/AttachmentPicker';
import { UploadProgressList } from '../attachments/UploadProgressList';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/useToast';

interface UploadFilesModalProps {
  open: boolean;
  onClose: () => void;
  scope: AttachmentScope;
  /** "công việc" | "dự án" để hiển thị trong tiêu đề */
  targetLabel: string;
}

/** Tải file thẳng vào thư mục đang xem: chọn file (AttachmentPicker), tải lần lượt từng file, file lỗi giữ lại để thử lại */
export function UploadFilesModal({ open, onClose, scope, targetLabel }: UploadFilesModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const batch = useBatchUpload();
  const [files, setFiles] = useState<File[]>([]);
  const failedCount = batch.entries.filter((e) => e.status === 'error').length;
  const showProgress = batch.running || batch.entries.length > 0;

  const close = () => {
    if (batch.running) return;
    setFiles([]);
    batch.reset();
    onClose();
  };

  const start = async () => {
    const failed = await batch.run(attachmentPath(scope), files);
    setFiles(failed);
    await invalidateAttachmentRelated(queryClient, scope);
    if (failed.length === 0) {
      toast.show(`Đã tải lên ${batch.entries.length || files.length} file`, 'success');
      setFiles([]);
      batch.reset();
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={close} title={`Tải file lên ${targetLabel}`} size="lg">
      <div className="space-y-4">
        {showProgress ? (
          <>
            {!batch.running && failedCount > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {failedCount} file chưa tải lên được. Bạn có thể thử lại các file đó.
              </div>
            )}
            <UploadProgressList entries={batch.entries} />
          </>
        ) : (
          <AttachmentPicker files={files} onChange={setFiles} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close} disabled={batch.running}>
            {failedCount > 0 ? 'Đóng' : 'Hủy'}
          </Button>
          <Button onClick={() => void start()} loading={batch.running} disabled={files.length === 0}>
            {failedCount > 0 ? `Thử lại ${failedCount} file` : files.length > 0 ? `Tải lên ${files.length} file` : 'Tải lên'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
