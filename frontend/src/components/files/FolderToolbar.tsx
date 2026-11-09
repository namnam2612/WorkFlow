import { LayoutGrid, Rows3 } from 'lucide-react';
import type { ViewMode } from '../../hooks/useViewMode';
import { inputClass } from '../../lib/styles';
import { Button } from '../ui/Button';

interface SortOption {
  value: string;
  label: string;
}

interface FolderToolbarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  sortBy: string;
  order: 'asc' | 'desc';
  sortOptions: SortOption[];
  onSortChange: (sortBy: string, order: 'asc' | 'desc') => void;
  /** Cấp 2: công tắc "Hiện cả task chưa có file" */
  includeEmpty?: boolean;
  onIncludeEmptyChange?: (value: boolean) => void;
}

/** Thanh công cụ mỗi cấp: sắp xếp (theo tên / cập nhật mới nhất), lưới ⇄ danh sách */
export function FolderToolbar({ view, onViewChange, sortBy, order, sortOptions, onSortChange, includeEmpty, onIncludeEmptyChange }: FolderToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="sr-only" htmlFor="folder-sort">
        Sắp xếp theo
      </label>
      <select
        id="folder-sort"
        value={`${sortBy}:${order}`}
        onChange={(e) => {
          const [field, dir] = e.target.value.split(':');
          onSortChange(field ?? sortOptions[0]?.value ?? 'name', dir === 'asc' ? 'asc' : 'desc');
        }}
        className={`${inputClass} w-auto!`}
      >
        {sortOptions.flatMap((o) => [
          <option key={`${o.value}:asc`} value={`${o.value}:asc`}>
            {o.label} ↑
          </option>,
          <option key={`${o.value}:desc`} value={`${o.value}:desc`}>
            {o.label} ↓
          </option>,
        ])}
      </select>
      {onIncludeEmptyChange && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={includeEmpty ?? false} onChange={(e) => onIncludeEmptyChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Hiện cả task chưa có file
        </label>
      )}
      <div className="ml-auto inline-flex gap-1" role="group" aria-label="Kiểu hiển thị">
        <Button variant={view === 'grid' ? 'primary' : 'secondary'} size="sm" icon={<LayoutGrid className="h-4 w-4" />} aria-pressed={view === 'grid'} onClick={() => onViewChange('grid')}>
          Lưới
        </Button>
        <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" icon={<Rows3 className="h-4 w-4" />} aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>
          Danh sách
        </Button>
      </div>
    </div>
  );
}
