import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { UploadEntry } from '../../hooks/useBatchUpload';
import { formatBytes } from '../../lib/files';

/** Tiến trình tải lên của từng file; file lỗi hiện kèm lý do */
export function UploadProgressList({ entries }: { entries: UploadEntry[] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Tiến trình tải lên">
      {entries.map((entry, index) => (
        <li key={`${entry.file.name}-${index}`} className="px-3 py-2">
          <div className="flex items-center gap-2">
            {entry.status === 'done' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Đã tải lên" />
            ) : entry.status === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-label="Lỗi" />
            ) : entry.status === 'uploading' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-label="Đang tải lên" />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300" aria-label="Đang chờ" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-slate-900" title={entry.file.name}>
              {entry.file.name}
            </span>
            <span className="tabular shrink-0 text-xs text-slate-500">
              {entry.status === 'uploading' ? `${entry.percent}%` : formatBytes(entry.file.size)}
            </span>
          </div>
          {entry.status === 'uploading' && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={entry.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Tải lên ${entry.file.name}`}>
              <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${entry.percent}%` }} />
            </div>
          )}
          {entry.status === 'error' && entry.error && <p className="mt-1 pl-6 text-xs text-red-600">{entry.error}</p>}
        </li>
      ))}
    </ul>
  );
}
