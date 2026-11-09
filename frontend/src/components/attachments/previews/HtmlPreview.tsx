import { useEffect, useState } from 'react';
import TextPreview from './TextPreview';

// Chặn mọi tài nguyên bên ngoài và script: HTML do người dùng tải lên không được gọi ra mạng
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">`;

/**
 * HTML: hiển thị trong iframe `sandbox=""` (không script, không form, không truy cập trang chính) kèm CSP chặn tải
 * tài nguyên ngoài nên mở file lạ cũng an toàn. Có thể chuyển sang xem mã nguồn.
 */
export default function HtmlPreview({ blob }: { blob: Blob }) {
  const [state, setState] = useState<{ blob: Blob; html: string } | null>(null);
  const [source, setSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void blob.text().then((html) => {
      if (!cancelled) setState({ blob, html });
    });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const current = state && state.blob === blob ? state : null;
  if (!current) return <p className="py-10 text-center text-sm text-slate-500">Đang đọc nội dung...</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Hiển thị an toàn: không chạy script, không tải tài nguyên từ bên ngoài.</p>
        <button type="button" onClick={() => setSource((v) => !v)} className="link-underline !normal-case !tracking-normal text-xs text-slate-700">
          {source ? 'Xem trang' : 'Xem mã nguồn'}
        </button>
      </div>
      {source ? (
        <TextPreview blob={blob} />
      ) : (
        <iframe title="Xem trước HTML" sandbox="" srcDoc={`${CSP}${current.html}`} className="h-[66vh] w-full rounded-xl border border-white/[0.08] bg-white" />
      )}
    </div>
  );
}
