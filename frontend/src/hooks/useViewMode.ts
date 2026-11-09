import { useCallback, useState } from 'react';

export type ViewMode = 'grid' | 'list';
const KEY = 'taskflow.filesView';

function read(): ViewMode {
  try {
    return localStorage.getItem(KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

/** Dạng hiển thị lưới/danh sách của Kho tài liệu; ghi nhớ ở localStorage và dùng chung cho mọi cấp */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(read);
  const update = useCallback((next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // bỏ qua: chỉ mất ghi nhớ
    }
  }, []);
  return [mode, update];
}
