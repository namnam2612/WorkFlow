import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Flag, PlaneTakeoff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/States';
import { StatusBadge } from '../components/ui/Badges';
import { useProjects } from '../hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { buildMonthGrid, eachDayKey, monthTitle, todayKey, vnDateKey, weekdayIndex } from '../lib/calendar';
import { LEAVE_TYPE_LABEL } from '../lib/constants';
import { chipClass, inputClass } from '../lib/styles';
import type { CalendarData, Leave, Task } from '../types/api';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

interface DayItems {
  due: Task[];
  start: Task[];
  leaves: Leave[];
  sprintStart: string[];
  sprintEnd: string[];
}

function useCalendar(from: string, to: string, projectId: number | undefined, mine: boolean) {
  return useQuery({
    queryKey: ['calendar', from, to, projectId, mine],
    queryFn: () => api.get<CalendarData>('/calendar', { from, to, projectId, mine }),
  });
}

/** Gom công việc, nghỉ phép và mốc sprint theo từng ngày (giờ VN) */
function groupByDay(data: CalendarData | undefined): Map<string, DayItems> {
  const map = new Map<string, DayItems>();
  const at = (key: string): DayItems => {
    let item = map.get(key);
    if (!item) {
      item = { due: [], start: [], leaves: [], sprintStart: [], sprintEnd: [] };
      map.set(key, item);
    }
    return item;
  };
  if (!data) return map;
  for (const t of data.tasks) {
    const due = t.deadline ? vnDateKey(t.deadline) : null;
    const start = t.startDate ? vnDateKey(t.startDate) : null;
    if (due) at(due).due.push(t);
    if (start && start !== due) at(start).start.push(t);
  }
  for (const l of data.leaves) {
    for (const key of eachDayKey(vnDateKey(l.startDate), vnDateKey(l.endDate))) {
      if (weekdayIndex(key) < 5) at(key).leaves.push(l);
    }
  }
  for (const s of data.sprints) {
    if (s.startDate) at(vnDateKey(s.startDate)).sprintStart.push(s.name);
    if (s.endDate) at(vnDateKey(s.endDate)).sprintEnd.push(s.name);
  }
  return map;
}

function TaskChip({ task, kind }: { task: Task; kind: 'due' | 'start' }) {
  const overdue = kind === 'due' && task.status.category !== 'done' && task.deadline !== null && new Date(task.deadline).getTime() < Date.now();
  return (
    <Link
      to={`/tasks/${task.id}`}
      title={`${kind === 'due' ? 'Hạn' : 'Bắt đầu'}: ${task.title} — ${task.status.name}`}
      className={clsx(
        'flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight transition-colors hover:border-white/40',
        kind === 'start' ? 'border-dashed border-white/[0.14] text-slate-500' : 'border-white/[0.08] text-slate-900',
        overdue && 'border-red-300 text-red-600',
        task.status.category === 'done' && 'line-through opacity-60',
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.status.color }} aria-hidden />
      <span className="truncate">{task.title}</span>
    </Link>
  );
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState({ year: Number(todayKey().slice(0, 4)), month: Number(todayKey().slice(5, 7)) - 1 });
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [mine, setMine] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const projectsQuery = useProjects();
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const first = grid[0]?.key ?? todayKey();
  const last = grid[grid.length - 1]?.key ?? todayKey();
  const query = useCalendar(first, last, projectId, mine);
  const days = useMemo(() => groupByDay(query.data), [query.data]);
  const today = todayKey();
  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  const opened = openDay ? days.get(openDay) : undefined;

  return (
    <>
      <PageHeader title="Lịch" description="Deadline, ngày bắt đầu, sprint và ngày nghỉ của nhóm trên một lịch" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1">
          <button type="button" aria-label="Tháng trước" onClick={() => shift(-1)} className="rounded-full border border-white/[0.08] p-2 text-slate-600 hover:bg-white/10 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Tháng sau" onClick={() => shift(1)} className="rounded-full border border-white/[0.08] p-2 text-slate-600 hover:bg-white/10 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="min-w-36 text-lg font-semibold text-slate-900">{monthTitle(cursor.year, cursor.month)}</h2>
        <button type="button" className={chipClass(false)} onClick={() => setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })}>
          Hôm nay
        </button>
        <button type="button" aria-pressed={mine} className={chipClass(mine)} onClick={() => setMine((v) => !v)}>
          Việc của tôi
        </button>
        <select aria-label="Dự án" value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)} className={`${inputClass} ml-auto w-auto!`}>
          <option value="">Tất cả dự án</option>
          {(projectsQuery.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-card">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-white/[0.08] bg-white/[0.02]">
              {WEEKDAYS.map((w) => (
                <div key={w} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[1px] text-slate-500">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((cell, index) => {
                const items = days.get(cell.key);
                const shown = [...(items?.due.map((t) => ({ t, kind: 'due' as const })) ?? []), ...(items?.start.map((t) => ({ t, kind: 'start' as const })) ?? [])];
                const extra = Math.max(0, shown.length - 3);
                const weekend = weekdayIndex(cell.key) >= 5;
                return (
                  <div
                    key={cell.key}
                    className={clsx('min-h-28 border-white/[0.06] p-1.5', index % 7 !== 6 && 'border-r', index < grid.length - 7 && 'border-b', !cell.inMonth && 'opacity-40', weekend && 'bg-white/[0.015]')}
                  >
                    <button type="button" onClick={() => setOpenDay(cell.key)} aria-label={`Xem ngày ${cell.key}`} className="mb-1 flex w-full items-center justify-between">
                      <span className={clsx('flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums', cell.key === today ? 'bg-white font-semibold text-black' : 'text-slate-600')}>{cell.day}</span>
                      {(items?.sprintStart.length || items?.sprintEnd.length) ? <Flag className="h-3 w-3 text-slate-500" aria-label="Mốc sprint" /> : null}
                    </button>
                    <div className="space-y-1">
                      {shown.slice(0, 3).map(({ t, kind }) => (
                        <TaskChip key={`${kind}-${t.id}`} task={t} kind={kind} />
                      ))}
                      {extra > 0 && (
                        <button type="button" onClick={() => setOpenDay(cell.key)} className="w-full text-left text-[11px] text-slate-500 hover:text-white">
                          +{extra} việc nữa
                        </button>
                      )}
                      {(items?.leaves ?? []).slice(0, 2).map((l) => (
                        <div key={l.id} className="flex items-center gap-1 truncate rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-400" title={`${l.user.name} nghỉ (${LEAVE_TYPE_LABEL[l.type]})`}>
                          <PlaneTakeoff className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{l.user.name}</span>
                        </div>
                      ))}
                      {(items?.leaves.length ?? 0) > 2 && <p className="text-[11px] text-sky-400">+{(items?.leaves.length ?? 0) - 2} người nghỉ</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>Ô liền: hạn hoàn thành</span>
        <span>Ô nét đứt: ngày bắt đầu</span>
        <span className="inline-flex items-center gap-1">
          <PlaneTakeoff className="h-3 w-3 text-sky-400" /> Nghỉ phép đã duyệt
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag className="h-3 w-3" /> Bắt đầu/kết thúc sprint
        </span>
      </p>

      {openDay && (
        <Modal open onClose={() => setOpenDay(null)} title={`Ngày ${openDay.slice(8, 10)}/${openDay.slice(5, 7)}/${openDay.slice(0, 4)}`} size="lg">
          <div className="space-y-4 text-sm">
            {opened?.sprintStart.map((n) => (
              <p key={`s-${n}`} className="flex items-center gap-2 text-slate-600">
                <Flag className="h-4 w-4" /> {n} bắt đầu
              </p>
            ))}
            {opened?.sprintEnd.map((n) => (
              <p key={`e-${n}`} className="flex items-center gap-2 text-slate-600">
                <Flag className="h-4 w-4" /> {n} kết thúc
              </p>
            ))}
            {opened && opened.due.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-[1px] text-slate-500">Đến hạn ({opened.due.length})</h3>
                <ul className="divide-y divide-slate-100">
                  {opened.due.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <Link to={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:text-brand-700">
                        {t.title}
                      </Link>
                      <span className="text-xs text-slate-500">{t.project?.name}</span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {opened && opened.start.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-[1px] text-slate-500">Bắt đầu ({opened.start.length})</h3>
                <ul className="divide-y divide-slate-100">
                  {opened.start.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <Link to={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:text-brand-700">
                        {t.title}
                      </Link>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {opened && opened.leaves.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-[1px] text-slate-500">Vắng mặt ({opened.leaves.length})</h3>
                <ul className="divide-y divide-slate-100">
                  {opened.leaves.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 py-2 text-slate-900">
                      <span className="flex-1">{l.user.name}</span>
                      <span className="text-xs text-slate-500">{LEAVE_TYPE_LABEL[l.type]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!opened || (opened.due.length === 0 && opened.start.length === 0 && opened.leaves.length === 0 && opened.sprintStart.length === 0 && opened.sprintEnd.length === 0) ? (
              <p className="text-slate-500">Không có gì vào ngày này.</p>
            ) : null}
          </div>
        </Modal>
      )}
    </>
  );
}
