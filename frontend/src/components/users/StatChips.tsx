import type { UserStats } from '../../types/api';

export function StatChips({ stats }: { stats: UserStats }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Đang làm {stats.counts.in_progress}</span>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Đã xong {stats.counts.done}</span>
      <span className={stats.overdue > 0 ? 'rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700' : 'rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500'}>
        Quá hạn {stats.overdue}
      </span>
    </div>
  );
}
