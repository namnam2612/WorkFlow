const MAX_ROWS = 500;
const MAX_COLS = 40;

/** Bảng dữ liệu chỉ đọc cho CSV/Excel. Dòng đầu được coi là tiêu đề. */
export function SheetTable({ rows, truncatedSource = false }: { rows: (string | number | boolean | Date | null)[][]; truncatedSource?: boolean }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-slate-500">Bảng trống.</p>;
  const shown = rows.slice(0, MAX_ROWS);
  const width = Math.min(MAX_COLS, Math.max(...shown.map((r) => r.length)));
  const cell = (value: string | number | boolean | Date | null): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString('vi-VN');
    return String(value);
  };
  const [head, ...body] = shown;
  return (
    <div>
      <div className="max-h-[62vh] overflow-auto rounded-xl border border-white/[0.08]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-modal">
            <tr>
              {Array.from({ length: width }, (_, c) => (
                <th key={c} scope="col" className="whitespace-nowrap border-b border-white/[0.14] px-3 py-2 text-xs font-semibold text-slate-900">
                  {cell(head[c] ?? null)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="odd:bg-white/[0.02]">
                {Array.from({ length: width }, (_, c) => (
                  <td key={c} className="max-w-[18rem] truncate border-b border-white/[0.06] px-3 py-1.5 text-slate-700" title={cell(row[c] ?? null)}>
                    {cell(row[c] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(rows.length > MAX_ROWS || truncatedSource) && <p className="mt-2 text-xs text-slate-500">Chỉ hiển thị {MAX_ROWS} dòng đầu, hãy tải về để xem đầy đủ.</p>}
    </div>
  );
}
