import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../lib/api';

const PAGE_STYLE = `<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#111;line-height:1.6;margin:0;padding:24px 32px;background:#fff}
  img{max-width:100%;height:auto} table{border-collapse:collapse} td,th{border:1px solid #bbb;padding:4px 8px}
  h1,h2,h3,h4{font-family:Arial,sans-serif;line-height:1.25} a{color:#1c62c4}
</style>`;

/**
 * Word (.docx): chuyển sang HTML bằng mammoth ngay ở trình duyệt rồi hiển thị trong iframe `sandbox=""`
 * (không chạy script, không truy cập trang chính) nên nội dung file không thể tác động tới ứng dụng.
 */
export default function DocxPreview({ blob }: { blob: Blob }) {
  const [state, setState] = useState<{ blob: Blob; html: string; warnings: number } | { blob: Blob; error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([import('mammoth'), blob.arrayBuffer()])
      .then(([mammoth, arrayBuffer]) => mammoth.convertToHtml({ arrayBuffer }))
      .then((result) => {
        if (!cancelled) setState({ blob, html: result.value, warnings: result.messages.length });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ blob, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const current = state && state.blob === blob ? state : null;
  if (!current) return <p className="py-10 text-center text-sm text-slate-500">Đang dựng nội dung tài liệu...</p>;
  if ('error' in current) return <p className="py-10 text-center text-sm text-red-600">Không đọc được file Word này ({current.error}). Hãy tải về để mở.</p>;
  return (
    <div>
      <iframe title="Xem trước tài liệu Word" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8">${PAGE_STYLE}${current.html || '<p>(Tài liệu trống)</p>'}`} className="h-[66vh] w-full rounded-xl border border-white/[0.08] bg-white" />
      <p className="mt-2 text-xs text-slate-500">Bản xem nhanh có thể khác định dạng gốc (phông chữ, bố cục). Tải về để xem đúng như bản Word.</p>
    </div>
  );
}
