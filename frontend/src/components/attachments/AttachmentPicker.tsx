import { X } from 'lucide-react';
import { useState } from 'react';
import { formatBytes, MAX_FILES_PER_UPLOAD, validateIncomingFiles } from '../../lib/files';
import { guessMime } from '../../lib/mime';
import { InlineError } from '../ui/States';
import { FileDropZone } from './FileDropZone';
import { FileIcon } from './FileIcon';

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Chọn file ngay trong form tạo/sửa dự án, công việc. File chỉ được GIỮ Ở TRÌNH DUYỆT; form gọi API tạo
 * trước rồi mới upload (xem useBatchUpload). Báo lỗi ngay khi file quá lớn / sai định dạng / quá số lượng.
 */
export function AttachmentPicker({ files, onChange, disabled = false }: AttachmentPickerProps) {
  const [errors, setErrors] = useState<string[]>([]);

  const add = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const { accepted, errors: found } = validateIncomingFiles(files, incoming);
    setErrors(found);
    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700">
        File đính kèm {files.length > 0 && <span className="tabular text-slate-500">({files.length}/{MAX_FILES_PER_UPLOAD})</span>}
      </p>
      <FileDropZone onFiles={add} disabled={disabled || files.length >= MAX_FILES_PER_UPLOAD} compact />
      {errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {errors.map((message) => (
            <InlineError key={message} message={message} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="File đã chọn">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 px-3 py-2">
              <FileIcon mime={guessMime(file)} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-900" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Bỏ chọn ${file.name}`}
                onClick={() => {
                  setErrors([]);
                  onChange(files.filter((_, i) => i !== index));
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
