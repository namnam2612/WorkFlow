import { Camera, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useAvatarMutations } from '../../hooks/useUsers';
import { getErrorMessage } from '../../lib/api';
import { toSquareJpeg } from '../../lib/image';
import type { User } from '../../types/api';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useToast } from '../ui/useToast';

interface AvatarEditorProps {
  user: User;
  /** Gọi sau khi đổi/xóa ảnh để làm mới thông tin tài khoản đang đăng nhập */
  onChanged: () => Promise<void>;
}

export function AvatarEditor({ user, onChanged }: AvatarEditorProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { upload, remove } = useAvatarMutations(user.id);
  const busy = upload.isPending || remove.isPending;

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // cho phép chọn lại cùng một tệp
    if (!file) return;
    try {
      const blob = await toSquareJpeg(file);
      await upload.mutateAsync(blob);
      await onChanged();
      toast.show('Đã cập nhật ảnh đại diện', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      await onChanged();
      toast.show('Đã xóa ảnh đại diện', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <Avatar name={user.name} avatarUrl={user.avatarUrl} size="xl" className="ring-1 ring-white/10" />
      <div className="text-center sm:text-left">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Chọn ảnh đại diện" onChange={(e) => void onPick(e)} />
          <Button variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} loading={upload.isPending} disabled={busy} onClick={() => inputRef.current?.click()}>
            {user.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
          {user.avatarUrl && (
            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} loading={remove.isPending} disabled={busy} onClick={() => void onRemove()}>
              Xóa ảnh
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">JPEG, PNG hoặc WebP. Ảnh được tự cắt vuông và thu nhỏ.</p>
      </div>
    </div>
  );
}
