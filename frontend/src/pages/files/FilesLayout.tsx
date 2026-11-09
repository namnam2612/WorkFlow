import { Rows3, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { FileSearchResults } from '../../components/files/FileSearchResults';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Card';
import { inputClass } from '../../lib/styles';

/**
 * Khung chung của Kho tài liệu dạng thư mục: tiêu đề + ô tìm kiếm LUÔN hiển thị ở trên cùng.
 * Có từ khóa (?q=) thì hiện kết quả tìm trên toàn kho thay cho thư mục đang xem; bấm đường dẫn của một kết quả
 * sẽ chuyển tới thư mục đó (đường dẫn không mang ?q= nên kết quả tìm tự đóng).
 */
export default function FilesLayout() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const searching = q.trim() !== '';
  const [input, setInput] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  const timer = useRef<number | undefined>(undefined);

  // Từ khóa bị xóa từ bên ngoài (bấm sang thư mục khác) thì làm trống ô nhập; không ghi đè khi đang gõ
  if (q !== prevQ) {
    setPrevQ(q);
    if (q === '') setInput('');
  }

  const setQuery = (value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value.trim() === '') next.delete('q');
        else next.set('q', value.trim());
        next.delete('page'); // trang của kết quả tìm / của thư mục là hai thứ khác nhau
        return next;
      },
      { replace: true },
    );
  };

  const onChange = (value: string) => {
    setInput(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQuery(value), 350);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const clear = () => {
    window.clearTimeout(timer.current);
    setInput('');
    setQuery('');
  };

  return (
    <>
      <PageHeader
        title="Kho tài liệu"
        description="Duyệt file theo thư mục: Dự án → Công việc → File."
        actions={
          <Link to="/documents">
            <Button variant="secondary" size="sm" icon={<Rows3 className="h-4 w-4" />}>
              Xem tất cả file (dạng phẳng)
            </Button>
          </Link>
        }
      />

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
        <input
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') clear();
          }}
          placeholder="Tìm file theo tên trên toàn bộ kho..."
          aria-label="Tìm file trên toàn kho"
          className={`${inputClass} pl-9 pr-10`}
        />
        {input !== '' && (
          <button type="button" onClick={clear} aria-label="Xóa từ khóa" className="absolute right-3 top-3 rounded-md p-0.5 text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching ? (
        <FileSearchResults
          q={q.trim()}
          page={Math.max(1, Number(params.get('page')) || 1)}
          onPage={(p) =>
            setParams(
              (current) => {
                const next = new URLSearchParams(current);
                if (p > 1) next.set('page', String(p));
                else next.delete('page');
                return next;
              },
              { replace: true },
            )
          }
        />
      ) : (
        <Outlet />
      )}
    </>
  );
}
