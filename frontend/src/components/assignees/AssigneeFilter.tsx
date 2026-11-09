import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { UserBrief } from '../../types/api';
import { Avatar } from '../ui/Avatar';

interface AssigneeFilterProps {
  users: UserBrief[];
  value: number[];
  onChange: (ids: number[]) => void;
  /** Thêm lựa chọn "Chưa giao" (lọc client như ở Kanban) */
  unassigned?: boolean;
  onUnassignedChange?: (value: boolean) => void;
  label?: string;
  className?: string;
}

/** Bộ lọc "Người được giao" chọn nhiều người: nút tóm tắt + bảng có ô tìm kiếm và checkbox */
export function AssigneeFilter({ users, value, onChange, unassigned = false, onUnassignedChange, label = 'Người thực hiện', className }: AssigneeFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const picked = users.filter((u) => value.includes(u.id));
  const count = picked.length + (unassigned ? 1 : 0);
  const summary =
    count === 0 ? `${label}: tất cả` : count === 1 ? (unassigned ? 'Chưa giao' : (picked[0]?.name ?? '')) : `${count} người được chọn`;
  const needle = query.trim().toLocaleLowerCase('vi');
  const visible = users.filter((u) => needle === '' || u.name.toLocaleLowerCase('vi').includes(needle));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        type="button"
        aria-label={`Lọc theo ${label.toLocaleLowerCase('vi')}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.14] bg-transparent px-3 py-2.5 text-left text-sm text-slate-900 transition-colors duration-300 hover:border-white/30"
      >
        <span className={clsx('truncate', count === 0 && 'text-slate-500')}>{summary}</span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="absolute left-0 z-30 mt-1 w-72 max-w-[85vw] rounded-xl border border-white/[0.14] bg-card shadow-[0_22px_50px_var(--shadow-lift)]">
          <div className="border-b border-slate-200 p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm thành viên..."
              aria-label="Tìm thành viên"
              className="w-full rounded-lg border border-white/[0.14] bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-white/50"
            />
          </div>
          <ul role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {onUnassignedChange && needle === '' && (
              <li role="option" aria-selected={unassigned}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" checked={unassigned} onChange={(e) => onUnassignedChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  <span className="text-sm text-slate-800">Chưa giao</span>
                </label>
              </li>
            )}
            {visible.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Không có thành viên phù hợp</li>}
            {visible.map((user) => (
              <li key={user.id} role="option" aria-selected={value.includes(user.id)}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" checked={value.includes(user.id)} onChange={() => toggle(user.id)} className="h-4 w-4 rounded border-slate-300" />
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{user.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {count > 0 && (
            <div className="border-t border-slate-200 px-3 py-1.5 text-right">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  onUnassignedChange?.(false);
                }}
                className="text-xs font-medium text-slate-600 hover:text-white"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
