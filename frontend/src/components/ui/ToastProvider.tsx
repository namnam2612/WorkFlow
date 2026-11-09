import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastContextValue, type ToastKind } from './toast-context';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
// Toast là viên thuốc trắng chữ đen; chỉ lỗi mới dùng màu để có ý nghĩa
const STYLES: Record<ToastKind, string> = {
  success: 'border-transparent bg-white text-black',
  error: 'border-red-300 bg-card text-red-600',
  info: 'border-transparent bg-white text-black',
};
const DURATION_MS: Record<ToastKind, number> = { success: 2200, info: 2200, error: 4000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastContextValue['show']>(
    (message, kind = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[kind]);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div key={toast.id} role="status" className={clsx('pointer-events-auto flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium shadow-[0_22px_50px_var(--shadow-lift)] [animation:toast-in_0.5s_var(--ease-out)_both]', STYLES[toast.kind])}>
              <Icon className="h-4 w-4 shrink-0" />
              <p className="flex-1">{toast.message}</p>
              <button type="button" aria-label="Đóng" onClick={() => dismiss(toast.id)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
