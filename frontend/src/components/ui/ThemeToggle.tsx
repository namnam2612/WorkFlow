import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './useTheme';

/** Công tắc chọn giao diện Tối / Sáng (hai nút viên thuốc, nút đang chọn nền trắng chữ đen) */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const option = (value: 'dark' | 'light', label: string, Icon: typeof Sun) => (
    <button
      type="button"
      onClick={() => setTheme(value)}
      aria-pressed={theme === value}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color] duration-300',
        theme === value ? 'bg-white text-black' : 'text-slate-500 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
  return (
    <div role="group" aria-label="Giao diện" className={clsx('inline-flex items-center gap-0.5 rounded-full border border-white/[0.08] p-0.5', className)}>
      {option('dark', 'Giao diện tối', Moon)}
      {option('light', 'Giao diện sáng', Sun)}
    </div>
  );
}
