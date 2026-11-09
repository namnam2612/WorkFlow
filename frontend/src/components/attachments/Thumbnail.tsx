import { useEffect, useRef, useState } from 'react';
import { usePreviewUrl } from '../../hooks/useAttachments';
import type { Attachment } from '../../types/api';
import { FileIcon } from './FileIcon';

/** Ảnh thu nhỏ cho file ảnh trong dạng lưới. Chỉ tải khi ô lưới cuộn tới gần màn hình (lazy). */
export function Thumbnail({ attachment }: { attachment: Attachment }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  // SVG hiển thị qua <img> (script không chạy); các ảnh khác như thường
  const isImage = attachment.previewable && attachment.mimeType.startsWith('image/');
  const { url } = usePreviewUrl(attachment.id, isImage && near);

  useEffect(() => {
    const node = ref.current;
    if (!node || !isImage) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isImage]);

  return (
    <div ref={ref} className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04]">
      {isImage && url ? (
        <img src={url} alt={attachment.originalName} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <FileIcon mime={attachment.mimeType} className="h-16 w-16 !border-0 !bg-transparent" />
      )}
    </div>
  );
}
