import type { UploadEntry } from '../../hooks/useBatchUpload';
import { Button } from '../ui/Button';
import { UploadProgressList } from './UploadProgressList';

interface FormUploadPhaseProps {
  /** "dự án" | "công việc" */
  noun: string;
  entries: UploadEntry[];
  uploading: boolean;
  onRetry: () => void;
  onSkip: () => void;
}

/** Màn thay thế nội dung form sau khi đã lưu: tiến trình từng file, hoặc báo file nào lỗi để thử lại */
export function FormUploadPhase({ noun, entries, uploading, onRetry, onSkip }: FormUploadPhaseProps) {
  const failed = entries.filter((e) => e.status === 'error');
  return (
    <div className="space-y-4" aria-live="polite">
      {uploading ? (
        <p className="text-sm text-slate-700">Đang tải file lên, vui lòng không đóng cửa sổ...</p>
      ) : (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          Đã lưu {noun}, nhưng {failed.length} file chưa tải lên được. Bạn có thể thử lại, hoặc đính kèm sau trong trang chi tiết.
        </div>
      )}
      <UploadProgressList entries={entries} />
      {!uploading && (
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onSkip}>
            Bỏ qua và đóng
          </Button>
          <Button onClick={onRetry}>Thử lại {failed.length} file</Button>
        </div>
      )}
    </div>
  );
}
