import { Search } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { inputClass } from '../../lib/styles';

/** Ô tìm kiếm ở thanh đầu trang: Enter chuyển tới trang kết quả /search?q= */
export function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = location.pathname === '/search' ? (new URLSearchParams(location.search).get('q') ?? '') : '';
  const [value, setValue] = useState(initial);

  return (
    <form
      role="search"
      className="relative hidden w-64 xl:block"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tìm việc, tài liệu, file..." aria-label="Tìm kiếm toàn hệ thống" className={`${inputClass} !rounded-full py-2 pl-9 text-[13px]`} />
    </form>
  );
}
