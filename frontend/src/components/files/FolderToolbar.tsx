import clsx from 'clsx';
import { ArrowDown, ArrowUp, LayoutGrid, Rows3 } from 'lucide-react';
import type { ViewMode } from '../../hooks/useViewMode';
import { chipClass } from '../../lib/styles';
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

/**
 * Thanh công cụ mỗi cấp, cùng ngôn ngữ với các bộ lọc khác của app: sắp xếp là chip (bấm lại để đảo chiều),
 * lưới ⇄ danh sách là cặp nút như trang "Tất cả file".
 */
export function FolderToolbar({ view, onViewChange, sortBy, order, sortOptions, onSortChange, includeEmpty, onIncludeEmptyChange }: FolderToolbarProps) {
  const pick = (value: string) => {
    if (value === sortBy) onSortChange(value, order === 'asc' ? 'desc' : 'asc');
    else onSortChange(value, value === 'name' ? 'asc' : 'desc');
  };
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sắp xếp theo">
        <span className="eyebrow !tracking-[2px]">Sắp xếp</span>
        {sortOptions.map((o) => {
          const active = o.value === sortBy;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              title={active ? (order === 'asc' ? 'Đang tăng dần, bấm để giảm dần' : 'Đang giảm dần, bấm để tăng dần') : undefined}
              onClick={() => pick(o.value)}
              className={clsx(chipClass(active), 'inline-flex items-center gap-1.5')}
            >
              {o.label}
              {active && (order === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
            </button>
          );
        })}
      </div>
      {onIncludeEmptyChange && (
        <button type="button" aria-pressed={includeEmpty ?? false} onClick={() => onIncludeEmptyChange(!includeEmpty)} className={chipClass(includeEmpty ?? false)}>
          Hiện cả task chưa có file
        </button>
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
