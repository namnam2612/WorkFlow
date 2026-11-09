import { AlertTriangle, ListTodo } from 'lucide-react';
import { CATEGORIES, CATEGORY_LABEL, categoryChartColors } from '../../lib/constants';
import { useTheme } from '../ui/useTheme';
import type { DashboardData } from '../../types/api';

interface StatusSummaryProps {
  counts: DashboardData['categoryCounts'];
  breakdown: DashboardData['statusBreakdown'];
  total: number;
  overdueCount: number;
}

function Tile({ label, value, accent, icon }: { label: string; value: number; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card p-4 transition-colors duration-300 hover:border-white/20">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-slate-500">
        {icon ?? <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: accent }} aria-hidden />}
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Thẻ số liệu theo NHÓM trạng thái (mỗi dự án có bộ trạng thái riêng) + thanh phân bố theo từng trạng thái
 * (màu do dự án đặt; một tổng chia thành các phần, khe 2px giữa các đoạn)
 */
export function StatusSummary({ counts, breakdown, total, overdueCount }: StatusSummaryProps) {
  const { theme } = useTheme();
  const colors = categoryChartColors(theme);
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <section aria-label="Số công việc theo trạng thái">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Tổng" value={total} icon={<ListTodo className="h-4 w-4 text-slate-400" />} />
        {CATEGORIES.map((category) => (
          <Tile key={category} label={CATEGORY_LABEL[category]} value={counts[category]} accent={colors[category]} />
        ))}
        <div className={`rounded-2xl border p-4 ${overdueCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-card'}`}>
          <div className={`flex items-center gap-2 text-xs uppercase tracking-[1px] ${overdueCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
            <AlertTriangle className="h-4 w-4" /> Quá hạn
          </div>
          <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${overdueCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>{overdueCount}</p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-card p-4">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={breakdown.map((s) => `${s.name}: ${s.count}`).join(', ')}>
            {breakdown
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.name} title={`${s.name}: ${s.count} (${pct(s.count)}%)`} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }} />
              ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
            {breakdown.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                {s.name}
                <span className="font-medium tabular-nums text-slate-900">
                  {s.count} ({pct(s.count)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
