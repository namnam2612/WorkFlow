import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-white text-black hover:scale-[1.04] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_var(--glow)]',
  secondary: 'border border-white/[0.08] bg-transparent text-white hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/5',
  danger: 'border border-red-200 bg-red-50 text-red-600 hover:-translate-y-0.5 hover:border-red-400/60 hover:bg-red-100',
  ghost: 'bg-transparent text-slate-600 hover:bg-white/5 hover:text-white',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-8 py-[15px] text-sm gap-2',
};

export function Button({ variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-semibold transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
