import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { getErrorMessage } from '../../lib/api';
import { Button } from './Button';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-white ${className}`} aria-label="Đang tải" />;
}

/** Skeleton khi tải: gradient #101010 → #181818 chạy ngang */
export function PageLoader({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid min-h-[40vh] w-full grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton h-36" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.14] bg-card px-6 py-14 text-center">
      <div className="mb-4 rounded-full border border-white/[0.08] bg-white/5 p-3.5 text-slate-500">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="font-semibold tracking-tight text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertTriangle className="mb-2 h-6 w-6 text-red-500" />
      <p className="font-medium text-red-800">Không thể tải dữ liệu</p>
      <p className="mt-1 text-sm text-red-700">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
      {message}
    </div>
  );
}
