import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STATUS_CHART_COLORS, STATUS_META } from '../../lib/constants';
import type { DashboardData, TaskStatus } from '../../types/api';
import { Button } from '../ui/Button';

type WorkloadRow = DashboardData['workload'][number];

// Thứ tự xếp chồng cố định: khớp thứ tự màu đã validate
const STACK_ORDER: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const SURFACE = '#ffffff';
const GRID = '#e2e8f0';
const INK_SECONDARY = '#475569';

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
}

function WorkloadTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null;
  const values = new Map(payload.map((p) => [String(p.dataKey), Number(p.value ?? 0)]));
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      {STACK_ORDER.map((status) => (
        <p key={status} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: STATUS_CHART_COLORS[status] }} aria-hidden />
          <span className="flex-1">{STATUS_META[status].label}</span>
          <span className="font-medium tabular-nums text-slate-900">{values.get(status) ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

export function WorkloadChart({ data }: { data: WorkloadRow[] }) {
  const [asTable, setAsTable] = useState(false);
  const height = Math.max(180, data.length * 44 + 40);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {STACK_ORDER.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_CHART_COLORS[status] }} aria-hidden />
              {STATUS_META[status].label}
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Xem biểu đồ' : 'Xem dạng bảng'}
        </Button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4 font-semibold">Thành viên</th>
                {STACK_ORDER.map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-semibold">
                    {STATUS_META[s].label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold text-red-600">Quá hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.userId}>
                  <td className="py-2 pr-4 font-medium text-slate-800">{row.name}</td>
                  {STACK_ORDER.map((s) => (
                    <td key={s} className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {row[s]}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-red-600">{row.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label="Biểu đồ khối lượng công việc theo thành viên">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: INK_SECONDARY }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 12, fill: INK_SECONDARY }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<WorkloadTooltip />} />
              {STACK_ORDER.map((status, index) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="workload"
                  fill={STATUS_CHART_COLORS[status]}
                  // Khe 2px màu nền giữa các đoạn; chỉ đoạn cuối bo góc đầu mút
                  stroke={SURFACE}
                  strokeWidth={2}
                  radius={index === STACK_ORDER.length - 1 ? [0, 4, 4, 0] : 0}
                  isAnimationActive={false}
                >
                  <LabelList dataKey={status} position="center" formatter={(value: unknown) => (Number(value) > 0 ? String(value) : '')} fill="#ffffff" fontSize={11} fontWeight={600} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
