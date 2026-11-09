import { AlertTriangle, ListTodo } from 'lucide-react';
import { STATUSES, STATUS_CHART_COLORS, STATUS_META } from '../../lib/constants';
import type { StatusCounts } from '../../types/api';

interface StatusSummaryProps {
  counts: StatusCounts;
  total: number;
  overdueCount: number;
}

function Tile({ label, value, accent, icon }: { label: string; value: number; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon ?? <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: accent }} aria-hidden />}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

/** Thẻ số liệu theo trạng thái + thanh phân bố (một tổng chia thành các phần, khe 2px giữa các đoạn) */
export function StatusSummary({ counts, total, overdueCount }: StatusSummaryProps) {
  return (
    <section aria-label="Số công việc theo trạng thái">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Tile label="Tổng" value={total} icon={<ListTodo className="h-4 w-4 text-slate-400" />} />
        {STATUSES.map((status) => (
          <Tile key={status} label={STATUS_META[status].label} value={counts[status]} accent={STATUS_CHART_COLORS[status]} />
        ))}
        <div className={`rounded-xl border p-4 shadow-sm ${overdueCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className={`flex items-center gap-2 text-sm ${overdueCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
            <AlertTriangle className="h-4 w-4" /> Quá hạn
          </div>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${overdueCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>{overdueCount}</p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={STATUSES.map((s) => `${STATUS_META[s].label}: ${counts[s]}`).join(', ')}>
            {STATUSES.filter((s) => counts[s] > 0).map((status) => (
              <div key={status} title={`${STATUS_META[status].label}: ${counts[status]} (${Math.round((counts[status] / total) * 100)}%)`} style={{ width: `${(counts[status] / total) * 100}%`, backgroundColor: STATUS_CHART_COLORS[status] }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
            {STATUSES.map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_CHART_COLORS[status] }} aria-hidden />
                {STATUS_META[status].label}
                <span className="font-medium tabular-nums text-slate-900">
                  {counts[status]} ({Math.round((counts[status] / total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
