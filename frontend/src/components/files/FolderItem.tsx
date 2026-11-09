import clsx from 'clsx';
import { Files, Folder } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { folderSummary } from '../../lib/files';
import { Reveal } from '../fx/Reveal';
import { TiltCard } from '../fx/TiltCard';
import { formatDate } from '../../lib/format';
import type { FolderStats } from '../../types/api';

/** project/task = thư mục thường; common = mục "File chung của dự án" (biểu tượng khác để phân biệt) */
export type FolderKind = 'project' | 'task' | 'common';

interface FolderItemProps {
  to: string;
  kind: FolderKind;
  name: string;
  stats: FolderStats;
  view: 'grid' | 'list';
  /** Thứ tự trong lưới (để hiệu ứng hiện dần lệch nhau như thẻ dự án) */
  index?: number;
  /** Phụ đề (vd "Việc con của ...") */
  note?: string;
  /** Huy hiệu bên phải (vd trạng thái task) */
  badge?: ReactNode;
}

function FolderIcon({ kind, className }: { kind: FolderKind; className?: string }) {
  const Icon = kind === 'common' ? Files : Folder;
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-xl border',
        kind === 'common' ? 'border-white/25 bg-white/[0.1] text-white' : 'border-white/[0.08] bg-white/[0.06] text-slate-700',
        className,
      )}
      aria-hidden
    >
      <Icon className="h-1/2 w-1/2" />
    </span>
  );
}

/** Một thư mục trong Kho tài liệu: dạng thẻ (lưới) hoặc dòng (danh sách) */
export function FolderItem({ to, kind, name, stats, view, index = 0, note, badge }: FolderItemProps) {
  const updated = stats.latestAt ? `Cập nhật ${formatDate(stats.latestAt)}` : null;
  if (view === 'list') {
    return (
      <li>
        <Link to={to} className="flex items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.04]">
          <FolderIcon kind={kind} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900" title={name}>
              {name}
            </p>
            {note && <p className="truncate text-xs text-slate-500">{note}</p>}
          </div>
          {badge}
          <p className="tabular hidden w-40 shrink-0 text-right text-sm text-slate-600 sm:block">{folderSummary(stats)}</p>
          <p className="tabular hidden w-40 shrink-0 text-right text-xs text-slate-500 md:block">{updated ?? '—'}</p>
        </Link>
      </li>
    );
  }
  return (
    <Reveal as="li" index={index}>
      <TiltCard className="rounded-2xl border border-white/[0.08] bg-card hover:border-white/20">
        <Link to={to} className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <FolderIcon kind={kind} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words font-semibold leading-snug text-slate-900" title={name}>
                {name}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{note ?? updated ?? 'Chưa có file'}</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
            <p className="tabular whitespace-nowrap text-sm text-slate-700">{folderSummary(stats)}</p>
            {badge ?? (note && stats.latestAt ? <p className="tabular whitespace-nowrap text-xs text-slate-500">{formatDate(stats.latestAt)}</p> : null)}
          </div>
        </Link>
      </TiltCard>
    </Reveal>
  );
}
