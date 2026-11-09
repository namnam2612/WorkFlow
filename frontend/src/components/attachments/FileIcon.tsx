import clsx from 'clsx';
import { iconFor } from '../../lib/files';

/** Biểu tượng theo loại file (ảnh / PDF / văn bản / bảng tính / nén / khác) */
export function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const Icon = iconFor(mime);
  return (
    <span className={clsx('flex shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-slate-600', className ?? 'h-10 w-10')} aria-hidden>
      <Icon className="h-1/2 w-1/2" />
    </span>
  );
}
