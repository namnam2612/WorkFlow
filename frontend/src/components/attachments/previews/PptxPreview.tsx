import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../lib/api';
import { readPptx, type PptxSlide } from '../../../lib/pptx';

/** PowerPoint (.pptx): xem nhanh từng slide (tiêu đề, chữ, ảnh). Cố định nền sáng như trang chiếu. */
export default function PptxPreview({ blob }: { blob: Blob }) {
  const [state, setState] = useState<{ blob: Blob; slides: PptxSlide[] } | { blob: Blob; error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    readPptx(blob)
      .then((slides) => {
        if (!cancelled) setState({ blob, slides });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ blob, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const current = state && state.blob === blob ? state : null;
  if (!current) return <p className="py-10 text-center text-sm text-slate-500">Đang đọc bài trình chiếu...</p>;
  if ('error' in current) return <p className="py-10 text-center text-sm text-red-600">Không đọc được file PowerPoint này ({current.error}). Hãy tải về để mở.</p>;
  if (current.slides.length === 0) return <p className="py-10 text-center text-sm text-slate-500">Không có slide nào.</p>;
  return (
    <div>
      <ol className="max-h-[64vh] space-y-4 overflow-auto pr-1">
        {current.slides.map((slide) => (
          <li key={slide.number}>
            <p className="mb-1 text-[11px] uppercase tracking-[1px] text-slate-500">Slide {slide.number}</p>
            <article className="min-h-[14rem] rounded-xl border border-white/[0.08] bg-[#ffffff] p-6 text-[#111111]">
              {slide.title && <h3 className="mb-3 text-xl font-bold leading-tight">{slide.title}</h3>}
              {slide.paragraphs.length > 0 && (
                <ul className="space-y-1.5 text-sm leading-relaxed">
                  {slide.paragraphs.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              )}
              {slide.images.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {slide.images.map((src, i) => (
                    <img key={i} src={src} alt={`Ảnh trong slide ${slide.number}`} className="max-h-48 max-w-full rounded-md object-contain" />
                  ))}
                </div>
              )}
              {!slide.title && slide.paragraphs.length === 0 && slide.images.length === 0 && <p className="text-sm text-neutral-400">(Slide không có chữ hoặc ảnh xem được)</p>}
            </article>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">Bản xem nhanh chỉ gồm chữ và ảnh của từng slide (không có bố cục, hiệu ứng). Tải về để xem đúng như bản PowerPoint.</p>
    </div>
  );
}
