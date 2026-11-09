import { useCallback, useState } from 'react';
import { getErrorMessage, uploadFiles } from '../lib/api';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadEntry {
  file: File;
  status: UploadStatus;
  percent: number;
  error?: string;
}

/**
 * Tải lên LẦN LƯỢT từng file (mỗi file một request) để hiện tiến trình từng file và biết chính xác file nào lỗi.
 * `run` trả về các file lỗi; không ném lỗi, để form còn báo "đã tạo xong, N file chưa tải được".
 */
export function useBatchUpload() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [running, setRunning] = useState(false);

  const patch = useCallback((index: number, change: Partial<UploadEntry>) => {
    setEntries((current) => current.map((entry, i) => (i === index ? { ...entry, ...change } : entry)));
  }, []);

  const run = useCallback(
    async (path: string, files: File[]): Promise<File[]> => {
      setRunning(true);
      setEntries(files.map((file) => ({ file, status: 'pending', percent: 0 })));
      const failed: File[] = [];
      for (const [index, file] of files.entries()) {
        patch(index, { status: 'uploading' });
        try {
          await uploadFiles(path, [file], (percent) => patch(index, { percent }));
          patch(index, { status: 'done', percent: 100 });
        } catch (error) {
          patch(index, { status: 'error', error: getErrorMessage(error) });
          failed.push(file);
        }
      }
      setRunning(false);
      return failed;
    },
    [patch],
  );

  const reset = useCallback(() => setEntries([]), []);

  return { entries, running, run, reset };
}
