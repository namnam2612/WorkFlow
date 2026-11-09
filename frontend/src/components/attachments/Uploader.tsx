import { formatDateTime } from '../../lib/format';
import type { Attachment } from '../../types/api';
import { Avatar } from '../ui/Avatar';

/** "Người gửi": avatar + tên (+ thời gian gửi) của người đã tải file lên */
export function Uploader({ attachment, showTime = false }: { attachment: Pick<Attachment, 'uploader' | 'createdAt'>; showTime?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar name={attachment.uploader.name} avatarUrl={attachment.uploader.avatarUrl} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">{attachment.uploader.name}</p>
        {showTime && <p className="text-xs text-slate-500">{formatDateTime(attachment.createdAt)}</p>}
      </div>
    </div>
  );
}
