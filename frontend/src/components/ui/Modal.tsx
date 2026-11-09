import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ open, title, onClose, children, size = 'md' }: ModalProps) {
  // Esc đóng modal; khi đóng, trả focus về phần tử đã mở nó
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[12px] [animation:fade-in_0.4s_ease_both]" onClick={onClose} />
      <div
        className={clsx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/[0.08] bg-modal shadow-[0_40px_100px_rgba(0,0,0,0.7)] [animation:modal-in_0.5s_var(--ease-out)_both] sm:rounded-3xl',
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/[0.08] text-slate-600 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:rotate-90 hover:bg-white/5 hover:text-white"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
