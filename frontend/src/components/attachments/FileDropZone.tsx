import clsx from 'clsx';
import { UploadCloud } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { formatBytes, MAX_FILES_PER_UPLOAD, MAX_UPLOAD_BYTES } from '../../lib/files';

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
  /** Nội dung thêm bên dưới gợi ý (vd thanh tiến trình) */
  children?: ReactNode;
}

/** Vùng kéo thả hoặc bấm để chọn nhiều file. Dùng chung cho chi tiết task/dự án và các form tạo/sửa. */
export function FileDropZone({ onFiles, disabled = false, compact = false, children }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={clsx(
        'rounded-2xl border border-dashed text-center transition-colors duration-300',
        compact ? 'px-4 py-4' : 'px-4 py-6',
        dragging ? 'border-white/50 bg-white/[0.06]' : 'border-white/[0.14] hover:border-white/30',
        disabled && 'opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        className="sr-only"
        aria-label="Chọn file đính kèm"
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      <UploadCloud className="mx-auto h-6 w-6 text-slate-500" aria-hidden />
      <p className="mt-2 text-sm text-slate-700">
        Kéo thả file vào đây hoặc{' '}
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="link-underline !normal-case !tracking-normal text-white disabled:opacity-50">
          bấm để chọn
        </button>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Tối đa {MAX_FILES_PER_UPLOAD} file mỗi lần, mỗi file {formatBytes(MAX_UPLOAD_BYTES)}. PDF, ảnh, Word, Excel, zip... Không nhận file thực thi (.exe, .sh, .bat...).
      </p>
      {children}
    </div>
  );
}
