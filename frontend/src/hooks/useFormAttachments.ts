import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { attachmentPath, invalidateAttachmentRelated, type AttachmentScope } from './useAttachments';
import { useBatchUpload } from './useBatchUpload';

/**
 * Luồng "chọn file trong form tạo/sửa": form gọi API tạo/sửa trước, có id rồi mới tải file lên.
 * Nếu có file lỗi, dự án/công việc VẪN được lưu; `savedId` được nhớ để thử lại chỉ các file lỗi mà không tạo trùng.
 */
export function useFormAttachments(kind: AttachmentScope['kind']) {
  const queryClient = useQueryClient();
  const batch = useBatchUpload();
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const { run } = batch;

  /** true = tất cả file đã lên; false = còn file lỗi (giữ lại trong `files` để thử lại) */
  const uploadFor = useCallback(
    async (id: number): Promise<boolean> => {
      if (files.length === 0) return true;
      const failed = await run(attachmentPath({ kind, id }), files);
      setFiles(failed);
      await invalidateAttachmentRelated(queryClient, { kind, id });
      return failed.length === 0;
    },
    [files, kind, queryClient, run],
  );

  return {
    files,
    setFiles,
    savedId,
    setSavedId,
    uploadFor,
    entries: batch.entries,
    uploading: batch.running,
    /** Đã lưu xong nhưng còn file chưa lên: form chuyển sang màn "thử lại" */
    hasFailures: savedId !== null && !batch.running && files.length > 0,
  };
}
