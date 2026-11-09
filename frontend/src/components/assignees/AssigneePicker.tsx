import { Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { UserBrief } from '../../types/api';
import { Avatar } from '../ui/Avatar';

interface AssigneePickerProps {
  /** Những người CÓ THỂ chọn (thường là thành viên của dự án) */
  options: UserBrief[];
  /** Người đã chọn; có thể gồm người không còn nằm trong `options` (vd đã rời dự án) */
  selected: UserBrief[];
  onChange: (users: UserBrief[]) => void;
  /** Những id không được bỏ/chọn (vd thành viên chỉ thao tác được với chính mình) */
  lockedIds?: number[];
  disabled?: boolean;
  emptyLabel?: string;
}

/**
 * Chọn NHIỀU người: hàng "chip" (avatar + tên + nút bỏ) và ô tìm kiếm mở danh sách có checkbox (avatar + tên).
 * Danh sách nằm trong luồng trang (không nổi) nên không bị modal cắt.
 */
export function AssigneePicker({ options, selected, onChange, lockedIds = [], disabled = false, emptyLabel = 'Chưa giao cho ai' }: AssigneePickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);

  const needle = query.trim().toLocaleLowerCase('vi');
  const filtered = options.filter((u) => needle === '' || u.name.toLocaleLowerCase('vi').includes(needle));

  const toggle = (user: UserBrief) => {
    if (locked.has(user.id)) return;
    onChange(selectedIds.has(user.id) ? selected.filter((u) => u.id !== user.id) : [...selected, user]);
  };

  return (
    <div>
      <ul className="mb-2 flex min-h-7 flex-wrap gap-1.5" aria-label="Người được giao">
        {selected.length === 0 && <li className="py-1 text-sm text-slate-400">{emptyLabel}</li>}
        {selected.map((user) => (
          <li key={user.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.04] py-0.5 pl-0.5 pr-2 text-sm text-slate-800">
            <Avatar name={user.name} avatarUrl={user.avatarUrl} size="xs" />
            <span className="max-w-[9rem] truncate" title={user.name}>
              {user.name}
            </span>
            {!locked.has(user.id) && !disabled && (
              <button type="button" aria-label={`Bỏ ${user.name} khỏi công việc`} onClick={() => toggle(user)} className="rounded-full p-0.5 text-slate-500 hover:bg-white/10 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Tìm thành viên để giao việc"
          autoComplete="off"
          disabled={disabled || options.length === 0}
          placeholder={options.length === 0 ? 'Chưa có thành viên để chọn' : 'Tìm và thêm người thực hiện...'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation(); // không đóng cả modal
              setOpen(false);
            }
          }}
          className="w-full rounded-xl border border-white/[0.14] bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors duration-300 placeholder:text-slate-500 focus:border-white/50 disabled:opacity-50"
        />
      </div>

      {open && !disabled && (
        <div className="mt-2 rounded-xl border border-slate-200">
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-label="Thành viên" className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Không tìm thấy thành viên phù hợp</li>}
            {filtered.map((user) => {
              const checked = selectedIds.has(user.id);
              const isLocked = locked.has(user.id);
              return (
                <li key={user.id} role="option" aria-selected={checked}>
                  <label className={`flex items-center gap-3 px-3 py-2 ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={checked} disabled={isLocked} onChange={() => toggle(user)} className="h-4 w-4 rounded border-slate-300" />
                    <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{user.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500">
            <span>Đã chọn {selected.length}</span>
            <button type="button" onClick={() => setOpen(false)} className="font-medium text-slate-700 hover:text-white">
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
