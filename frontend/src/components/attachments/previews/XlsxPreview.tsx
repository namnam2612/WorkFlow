import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../lib/api';
import { SheetTable } from './SheetTable';

type Sheets = { sheet: string; data: (string | number | boolean | Date | null)[][] }[];

/** Excel (.xlsx): đọc ngay ở trình duyệt, mỗi sheet một tab. Thư viện chỉ được tải khi mở bản xem trước. */
export default function XlsxPreview({ blob }: { blob: Blob }) {
  const [state, setState] = useState<{ blob: Blob; sheets: Sheets } | { blob: Blob; error: string } | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void import('read-excel-file/browser')
      .then(({ default: readXlsxFile }) => readXlsxFile(blob))
      .then((sheets) => {
        if (!cancelled) setState({ blob, sheets: sheets as Sheets });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ blob, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const current = state && state.blob === blob ? state : null;
  if (!current) return <p className="py-10 text-center text-sm text-slate-500">Đang đọc bảng tính...</p>;
  if ('error' in current) return <p className="py-10 text-center text-sm text-red-600">Không đọc được file Excel này ({current.error}). Hãy tải về để mở.</p>;
  const sheet = current.sheets[Math.min(active, current.sheets.length - 1)];
  return (
    <div>
      {current.sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Các sheet">
          {current.sheets.map((s, i) => (
            <button
              key={s.sheet}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                i === active ? 'border-white bg-white text-black' : 'border-white/[0.08] text-muted hover:border-white/25 hover:text-white',
              )}
            >
              {s.sheet}
            </button>
          ))}
        </div>
      )}
      {sheet ? <SheetTable rows={sheet.data} /> : <p className="py-10 text-center text-sm text-slate-500">File không có sheet nào.</p>}
    </div>
  );
}
