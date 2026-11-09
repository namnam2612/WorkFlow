import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TypeBadge } from '../components/ui/Badges';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useProject } from '../hooks/useProjects';
import { api } from '../lib/api';
import { addDaysKey, todayKey, vnDateKey, vnDayStart } from '../lib/calendar';
import { inputClass } from '../lib/styles';
import type { GanttData, Task } from '../types/api';

const ROW = 38;
const LABEL_W = 270;
const HEADER_H = 52;
const DAY = 24 * 60 * 60 * 1000;

interface Bar {
  task: Task;
  /** Chỉ số ngày so với đầu trục thời gian */
  start: number;
  end: number;
  /** Việc chưa có deadline: chỉ vẽ một điểm đánh dấu */
  open: boolean;
  summary?: boolean;
}

interface Row {
  key: string;
  label: string;
  task?: Task;
  bar?: Bar;
  group?: boolean;
}

const dayIndex = (key: string, origin: string): number => Math.round((vnDayStart(key) - vnDayStart(origin)) / DAY);

function progressOf(task: Task): number {
  if (task.status.category === 'done') return 1;
  return task.subtaskTotal > 0 ? task.subtaskDone / task.subtaskTotal : 0;
}

export default function GanttPage() {
  const projectId = Number(useParams().id);
  const projectQuery = useProject(projectId);
  const query = useQuery({ queryKey: ['gantt', projectId], queryFn: () => api.get<GanttData>(`/projects/${projectId}/gantt`), enabled: !Number.isNaN(projectId) });
  const [dayWidth, setDayWidth] = useState(30);
  const data = query.data;
  const scroller = useRef<HTMLDivElement | null>(null);

  const model = useMemo(() => {
    if (!data) return null;
    const dates = (t: Task): { s: string; e: string; open: boolean } => {
      const s = t.startDate ? vnDateKey(t.startDate) : t.deadline ? vnDateKey(t.deadline) : vnDateKey(t.createdAt);
      const e = t.deadline ? vnDateKey(t.deadline) : s;
      return { s: s <= e ? s : e, e: s <= e ? e : s, open: !t.deadline };
    };
    const epics = data.tasks.filter((t) => t.type === 'epic');
    const others = data.tasks.filter((t) => t.type !== 'epic');
    const keys = others.flatMap((t) => {
      const d = dates(t);
      return [d.s, d.e];
    });
    const sprintKeys = data.sprints.flatMap((s) => [s.startDate, s.endDate]).filter((v): v is string => v !== null).map(vnDateKey);
    const all = [...keys, ...sprintKeys, todayKey()];
    const origin = addDaysKey([...all].sort()[0] ?? todayKey(), -3);
    const endKey = addDaysKey([...all].sort()[all.length - 1] ?? todayKey(), 5);
    const totalDays = Math.max(14, dayIndex(endKey, origin) + 1);

    const bar = (t: Task, summary = false): Bar => {
      const d = dates(t);
      return { task: t, start: dayIndex(d.s, origin), end: dayIndex(d.e, origin), open: d.open, summary };
    };
    const rows: Row[] = [];
    const used = new Set<number>();
    for (const epic of epics) {
      const kids = others.filter((t) => t.epicId === epic.id);
      kids.forEach((k) => used.add(k.id));
      const bars = kids.map((k) => bar(k));
      const epicBar: Bar | undefined = bars.length > 0 ? { task: epic, start: Math.min(...bars.map((b) => b.start)), end: Math.max(...bars.map((b) => b.end)), open: false, summary: true } : undefined;
      rows.push({ key: `epic-${epic.id}`, label: epic.title, task: epic, bar: epicBar, group: true });
      for (const b of bars) rows.push({ key: `t-${b.task.id}`, label: b.task.title, task: b.task, bar: b });
    }
    const loose = others.filter((t) => !used.has(t.id));
    if (loose.length > 0 && epics.length > 0) rows.push({ key: 'loose', label: 'Không thuộc epic', group: true });
    for (const t of loose) rows.push({ key: `t-${t.id}`, label: t.title, task: t, bar: bar(t) });
    const rowOf = new Map(rows.filter((r) => r.task && !r.group).map((r) => [r.task?.id ?? 0, rows.indexOf(r)]));
    return { origin, totalDays, rows, rowOf, today: dayIndex(todayKey(), origin) };
  }, [data]);

  // Mở lên là cuộn tới "hôm nay" thay vì đầu trục thời gian
  useEffect(() => {
    if (scroller.current && model) scroller.current.scrollLeft = Math.max(0, model.today * dayWidth - 200);
  }, [model, dayWidth]);

  if (projectQuery.isLoading || query.isLoading) return <PageLoader />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (query.isError || !data || !model) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const project = projectQuery.data;
  const width = model.totalDays * dayWidth;
  const barOf = new Map(model.rows.filter((r) => r.bar && !r.group).map((r) => [r.task?.id ?? 0, r.bar as Bar]));

  const months: { label: string; left: number; width: number }[] = [];
  for (let i = 0; i < model.totalDays; i++) {
    const key = addDaysKey(model.origin, i);
    const label = `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}`;
    const last = months[months.length - 1];
    if (last && last.label === label) last.width += dayWidth;
    else months.push({ label, left: i * dayWidth, width: dayWidth });
  }

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Gantt</h1>
          <p className="text-sm text-slate-500">Tiến trình theo thời gian; mũi tên là phụ thuộc "xong rồi mới bắt đầu" (đỏ = đang vi phạm thứ tự ngày)</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Thu phóng
          <select aria-label="Thu phóng" value={dayWidth} onChange={(e) => setDayWidth(Number(e.target.value))} className={`${inputClass} w-auto!`}>
            <option value={16}>Tuần</option>
            <option value={30}>Ngày (vừa)</option>
            <option value={48}>Ngày (rộng)</option>
          </select>
        </label>
      </div>

      {model.rows.length === 0 ? (
        <EmptyState title="Dự án chưa có công việc" description="Thêm công việc kèm ngày bắt đầu và deadline để xem trên Gantt." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card">
          <div className="flex">
            <div className="shrink-0 border-r border-white/[0.08]" style={{ width: LABEL_W }}>
              <div className="flex items-end border-b border-white/[0.08] px-3 pb-2 text-[11px] font-medium uppercase tracking-[1px] text-slate-500" style={{ height: HEADER_H }}>
                Công việc
              </div>
              {model.rows.map((r) => (
                <div key={r.key} className={clsx('flex items-center gap-2 border-b border-white/[0.05] px-3', r.group && 'bg-white/[0.03] font-semibold')} style={{ height: ROW }}>
                  {r.task && <TypeBadge type={r.task.type} hideTask className="shrink-0" />}
                  {r.task ? (
                    <Link to={`/tasks/${r.task.id}`} className="truncate text-sm text-slate-900 hover:text-brand-700" title={r.label}>
                      {r.label}
                    </Link>
                  ) : (
                    <span className="truncate text-sm text-slate-500">{r.label}</span>
                  )}
                </div>
              ))}
            </div>

            <div ref={scroller} className="thin-scroll min-w-0 flex-1 overflow-x-auto">
              <div className="relative" style={{ width, height: HEADER_H + model.rows.length * ROW }}>
                <div className="absolute inset-x-0 top-0 border-b border-white/[0.08]" style={{ height: HEADER_H }}>
                  {months.map((m) => (
                    <div key={m.label} className="absolute top-0 truncate border-l border-white/[0.08] px-2 py-1 text-[11px] font-medium text-slate-600" style={{ left: m.left, width: m.width }}>
                      {m.label}
                    </div>
                  ))}
                  {dayWidth >= 30 &&
                    Array.from({ length: model.totalDays }, (_, i) => {
                      const key = addDaysKey(model.origin, i);
                      return (
                        <span key={key} className="absolute bottom-1 text-center text-[10px] tabular-nums text-slate-500" style={{ left: i * dayWidth, width: dayWidth }}>
                          {Number(key.slice(8, 10))}
                        </span>
                      );
                    })}
                </div>

                {/* Lưới dọc theo tuần + cuối tuần */}
                {Array.from({ length: model.totalDays }, (_, i) => {
                  const wd = (new Date(vnDayStart(addDaysKey(model.origin, i)) + 7 * 3600e3).getUTCDay() + 6) % 7;
                  return wd >= 5 ? <div key={i} className="absolute bg-white/[0.02]" style={{ left: i * dayWidth, top: HEADER_H, width: dayWidth, bottom: 0 }} /> : null;
                })}
                {model.rows.map((r, i) => (
                  <div key={r.key} className={clsx('absolute inset-x-0 border-b border-white/[0.05]', r.group && 'bg-white/[0.03]')} style={{ top: HEADER_H + i * ROW, height: ROW }} />
                ))}

                {/* Hôm nay */}
                {model.today >= 0 && model.today < model.totalDays && <div className="absolute z-10 w-px bg-red-500/70" style={{ left: model.today * dayWidth + dayWidth / 2, top: HEADER_H, bottom: 0 }} aria-label="Hôm nay" />}

                {/* Thanh công việc */}
                {model.rows.map((r, i) => {
                  const b = r.bar;
                  if (!b) return null;
                  const left = b.start * dayWidth + 2;
                  const w = Math.max(dayWidth - 4, (b.end - b.start + 1) * dayWidth - 4);
                  const done = progressOf(b.task);
                  const color = b.task.status.color;
                  return (
                    <div key={r.key} className="absolute z-[5]" style={{ left, top: HEADER_H + i * ROW + 8, width: b.open ? dayWidth - 4 : w, height: ROW - 16 }} title={`${b.task.title} · ${b.task.status.name}${b.open ? ' · chưa có deadline' : ''}`}>
                      {b.summary ? (
                        <div className="h-full rounded-sm border-y-2 border-white/40 bg-white/10" />
                      ) : (
                        <div className={clsx('relative h-full overflow-hidden rounded-md border', b.open ? 'border-dashed' : '')} style={{ borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }}>
                          <div className="h-full" style={{ width: `${Math.round(done * 100)}%`, backgroundColor: `color-mix(in srgb, ${color} 70%, transparent)` }} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Mũi tên phụ thuộc */}
                <svg className="pointer-events-none absolute left-0 top-0 z-[6]" width={width} height={HEADER_H + model.rows.length * ROW} aria-label="Phụ thuộc giữa các công việc">
                  <defs>
                    <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                    </marker>
                  </defs>
                  {data.dependencies.map((d) => {
                    const from = barOf.get(d.dependsOnId);
                    const to = barOf.get(d.taskId);
                    const fi = model.rowOf.get(d.dependsOnId);
                    const ti = model.rowOf.get(d.taskId);
                    if (!from || !to || fi === undefined || ti === undefined) return null;
                    const x1 = (from.end + 1) * dayWidth - 2;
                    const y1 = HEADER_H + fi * ROW + ROW / 2;
                    const x2 = to.start * dayWidth + 2;
                    const y2 = HEADER_H + ti * ROW + ROW / 2;
                    const violated = to.start <= from.end;
                    const mid = (y1 + y2) / 2;
                    const path = x2 >= x1 + 12 ? `M${x1} ${y1} H${x1 + 6} V${y2} H${x2}` : `M${x1} ${y1} H${x1 + 8} V${mid} H${x2 - 8} V${y2} H${x2}`;
                    return <path key={`${d.taskId}-${d.dependsOnId}`} d={path} fill="none" stroke="currentColor" strokeWidth={1.5} markerEnd="url(#arrow)" className={violated ? 'text-red-500' : 'text-slate-500'} />;
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Thanh nét đứt: chưa có deadline. Phần tô đậm: tiến độ (công việc con đã xong hoặc đã hoàn thành). Đường đỏ: hôm nay. Sửa ngày ở form công việc; phụ thuộc đặt ở trang chi tiết công việc.</p>
    </>
  );
}
