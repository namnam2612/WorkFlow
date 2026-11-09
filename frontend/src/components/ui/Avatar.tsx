import clsx from 'clsx';
import { initials } from '../../lib/format';

// Đơn sắc: các sắc độ xám khác nhau để phân biệt người, không dùng màu thương hiệu
const COLORS = ['bg-[#2a2a2a]', 'bg-[#333]', 'bg-[#3d3d3d]', 'bg-[#262626]', 'bg-[#474747]', 'bg-[#303030]', 'bg-[#3a3a3a]', 'bg-[#2e2e2e]'];

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-16 w-16 text-xl' };

export function Avatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} title={name} className={clsx('rounded-full object-cover', SIZES[size], className)} />;
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
