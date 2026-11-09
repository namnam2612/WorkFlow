import clsx from 'clsx';
import { useState } from 'react';
import { initials } from '../../lib/format';

// Đơn sắc: các sắc độ xám khác nhau để phân biệt người, không dùng màu thương hiệu
const COLORS = ['bg-white/[0.08]', 'bg-white/[0.11]', 'bg-white/[0.14]', 'bg-white/[0.17]', 'bg-white/[0.2]', 'bg-white/[0.1]', 'bg-white/[0.13]', 'bg-white/[0.16]'];

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-16 w-16 text-xl', xl: 'h-28 w-28 text-3xl' };

export function Avatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Ảnh lỗi (hoặc đã bị xóa) thì quay về chữ cái đầu
  if (avatarUrl && failedUrl !== avatarUrl) {
    return <img src={avatarUrl} alt={name} title={name} className={clsx('shrink-0 rounded-full object-cover', SIZES[size], className)} onError={() => setFailedUrl(avatarUrl)} />;
  }
  return (
    <span
      title={name}
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-inset ring-white/10', color, SIZES[size], className)}
    >
      {initials(name)}
    </span>
  );
}
