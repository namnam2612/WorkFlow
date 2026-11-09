import { useBlobText } from '../../../hooks/useBlobText';

/** Văn bản thuần / Markdown: hiển thị nguyên văn, giữ xuống dòng (React tự escape nên an toàn) */
export default function TextPreview({ blob }: { blob: Blob }) {
  const { text, truncated } = useBlobText(blob);
  if (text === null) return <p className="py-10 text-center text-sm text-slate-500">Đang đọc nội dung...</p>;
  return (
    <div className="max-h-[68vh] overflow-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-800">{text}</pre>
      {truncated && <p className="mt-3 text-xs text-slate-500">Chỉ hiển thị phần đầu của file, hãy tải về để xem đầy đủ.</p>}
    </div>
  );
}
