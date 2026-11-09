import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { formatBytes } from '../../lib/files';
import { formatDateTime } from '../../lib/format';
import type { Attachment } from '../../types/api';
import { AttachmentActions } from '../attachments/AttachmentActions';
import { Thumbnail } from '../attachments/Thumbnail';
import { Uploader } from '../attachments/Uploader';

/** Nơi file được đính vào: công việc (kèm dự án) hoặc chính dự án. Bấm vào tên để mở chi tiết. */
export function FileOwner({ file }: { file: Attachment }) {
  const link = 'block truncate underline decoration-white/20 underline-offset-4 hover:decoration-white';
  if (file.task) {
    return (
      <>
        <Link to={`/tasks/${file.task.id}`} title={file.task.title} className={clsx(link, 'text-xs text-slate-600')}>
          {file.task.title}
        </Link>
        <Link to={`/projects/${file.project.id}`} title={file.project.name} className="block truncate text-xs text-slate-500 hover:text-white">
          {file.project.name}
        </Link>
      </>
    );
  }
  return (
    <>
      <span className="mb-0.5 inline-block rounded-full border border-white/[0.14] px-2 py-px text-[10px] font-medium uppercase tracking-[1px] text-slate-600">Dự án</span>
      <Link to={`/projects/${file.project.id}`} title={file.project.name} className={clsx(link, 'text-xs text-slate-600')}>
        {file.project.name}
      </Link>
    </>
  );
}

interface FileCardProps {
  file: Attachment;
  onOpen: (f: Attachment) => void;
  onPreview: (f: Attachment) => void;
  onDelete: (f: Attachment) => void;
  /** Hiện dòng "Task / Dự án" (Kho tài liệu dạng phẳng); trong một thư mục thì không cần vì đã biết vị trí */
  showOwner?: boolean;
}

/** Thẻ file (dạng lưới): ảnh thu nhỏ hoặc biểu tượng loại file, tên, người gửi, dung lượng, thời gian, thao tác */
export function FileCard({ file, onOpen, onPreview, onDelete, showOwner = true }: FileCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-card p-3 transition-colors duration-300 hover:border-white/20">
      <button type="button" onClick={() => onOpen(file)} aria-label={file.previewable ? `Xem trước ${file.originalName}` : `Tải về ${file.originalName}`}>
        <Thumbnail attachment={file} />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900" title={file.originalName}>
          {file.originalName}
        </p>
        {showOwner && <FileOwner file={file} />}
      </div>
      <div className="mt-auto space-y-2 border-t border-white/[0.08] pt-3">
        <Uploader attachment={file} />
        <div className="flex items-center justify-between gap-2">
          <p className="tabular text-xs text-slate-500">
            {formatBytes(file.size)} · {formatDateTime(file.createdAt)}
          </p>
          <AttachmentActions attachment={file} onPreview={onPreview} onDelete={onDelete} />
        </div>
      </div>
    </li>
  );
}
