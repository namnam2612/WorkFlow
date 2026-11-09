import clsx from 'clsx';
import { initials } from '../../lib/format';

const COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500'];

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
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', color, SIZES[size], className)}
    >
      {initials(name)}
    </span>
  );
}
