import clsx from 'clsx';
import { ArrowLeft, BarChart3, Flag, Pencil, Play, Plus, Square, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AssigneeStack } from '../components/assignees/AssigneeStack';
import { CompleteSprintModal } from '../components/sprints/CompleteSprintModal';
import { SprintFormModal } from '../components/sprints/SprintFormModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { StatusBadge, TypeBadge } from '../components/ui/Badges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useProject } from '../hooks/useProjects';
import { useSprintCapacity } from '../hooks/useLeaves';
import { useBacklog, useDeleteSprint, useMoveToSprint, useStartSprint } from '../hooks/useSprints';
import { getErrorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { canManageProject } from '../lib/permissions';
import { chipClass, inputClass } from '../lib/styles';
import type { SprintStats, SprintWithStats, Task, TaskType } from '../types/api';

const SPRINT_STATUS_LABEL = { planned: 'Kế hoạch', active: 'Đang chạy', completed: 'Đã kết thúc' } as const;

/** Capacity thực tế của sprint: giờ khả dụng sau khi trừ nghỉ phép đã duyệt, so với điểm đã xếp vào sprint */
function CapacityLine({ sprintId, points }: { sprintId: number; points: number }) {
  const query = useSprintCapacity(sprintId);
  const c = query.data;
  if (!c) return null;
  return (
    <span className="tabular-nums" title={c.members.map((m) => `${m.user.name}: ${m.availableDays}/${m.workingDays} ngày`).join('\n')}>
      Capacity {c.totalAvailableHours} giờ ({c.totalAvailableDays} ngày công{c.totalLeaveDays > 0 ? `, trừ ${c.totalLeaveDays} ngày nghỉ` : ''})
      {c.totalAvailableDays > 0 && points > 0 ? ` · ${(points / c.totalAvailableDays).toFixed(1)} điểm/ngày` : ''}
    </span>
  );
}

function Progress({ stats }: { stats: SprintStats }) {
  const total = stats.points > 0 ? stats.points : stats.taskCount;
  const done = stats.points > 0 ? stats.donePoints : stats.doneCount;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
    </div>
  );
}

interface RowProps {
  task: Task;
  canManage: boolean;
  sprints: SprintWithStats[];
  onMove: (taskId: number, sprintId: number | null) => void;
}

/** Một việc trong sprint/backlog; leader/admin chuyển việc giữa backlog và các sprint bằng ô chọn */
function BacklogRow({ task, canManage, sprints, onMove }: RowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <TypeBadge type={task.type} hideTask className="shrink-0" />
      <Link to={`/tasks/${task.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:text-brand-700">
        {task.title}
      </Link>
      {task.epic && (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.14] px-2 py-0.5 text-[11px] text-slate-600" title="Epic">
          <Zap className="h-3 w-3" aria-hidden />
          {task.epic.title}
        </span>
      )}
      {task.storyPoints !== null && (
        <span className="rounded-full border border-white/[0.14] px-2 text-[11px] font-semibold tabular-nums text-slate-600" title="Story Point">
          {task.storyPoints}
        </span>
      )}
      <AssigneeStack assignees={task.assignees} size="sm" />
      <StatusBadge status={task.status} />
      {canManage && (
        <select
          aria-label={`Chuyển "${task.title}"`}
          value=""
          onChange={(e) => {
            if (e.target.value === '') return;
            onMove(task.id, e.target.value === 'backlog' ? null : Number(e.target.value));
          }}
          className={`${inputClass} w-auto! py-1 text-xs`}
        >
          <option value="">Chuyển…</option>
          {task.sprintId !== null && <option value="backlog">Về backlog</option>}
          {sprints
            .filter((s) => s.id !== task.sprintId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      )}
    </li>
  );
}

export default function BacklogPage() {
  const projectId = Number(useParams().id);
  const { user } = useAuth();
  const toast = useToast();
  const projectQuery = useProject(projectId);
  const [includeDone, setIncludeDone] = useState(false);
  const backlogQuery = useBacklog(projectId, includeDone);
  const move = useMoveToSprint(projectId);
  const start = useStartSprint();
  const remove = useDeleteSprint();

  const [sprintForm, setSprintForm] = useState<SprintWithStats | 'new' | null>(null);
  const [completing, setCompleting] = useState<SprintWithStats | null>(null);
  const [deleting, setDeleting] = useState<SprintWithStats | null>(null);
  const [creating, setCreating] = useState<{ type: TaskType; sprintId?: number } | null>(null);
  const [epicFilter, setEpicFilter] = useState<number | null>(null);

  const data = backlogQuery.data;
  const project = projectQuery.data;
  const canManage = canManageProject(user, project);
  const byEpic = (t: Task) => epicFilter === null || t.epicId === epicFilter;
  const openSprints = useMemo(() => data?.sprints ?? [], [data]);

  if (projectQuery.isLoading || backlogQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !project) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (backlogQuery.isError || !data) return <ErrorState error={backlogQuery.error} onRetry={() => void backlogQuery.refetch()} />;

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.show(success, 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };
  const moveTask = (taskId: number, sprintId: number | null) => void act(() => move.mutateAsync({ sprintId, taskIds: [taskId] }), sprintId === null ? 'Đã đưa về backlog' : 'Đã chuyển vào sprint');

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Backlog &amp; Sprint</h1>
          <p className="text-sm text-slate-500">Lập kế hoạch sprint, xếp việc từ backlog vào sprint và theo dõi epic</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/projects/${project.id}/reports`}>
            <Button variant="secondary" icon={<BarChart3 className="h-4 w-4" />}>
              Báo cáo
            </Button>
          </Link>
          {canManage && (
            <>
              <Button variant="secondary" icon={<Zap className="h-4 w-4" />} onClick={() => setCreating({ type: 'epic' })}>
                Tạo epic
              </Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSprintForm('new')}>
                Tạo sprint
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          {openSprints.map((sprint) => {
            const tasks = sprint.tasks.filter(byEpic);
            return (
              <Card
                key={sprint.id}
                title={`${sprint.name} · ${SPRINT_STATUS_LABEL[sprint.status]}`}
                action={
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canManage && sprint.status === 'planned' && (
                      <Button size="sm" icon={<Play className="h-3.5 w-3.5" />} loading={start.isPending} onClick={() => void act(() => start.mutateAsync(sprint.id), `Đã bắt đầu ${sprint.name}`)}>
                        Bắt đầu
                      </Button>
                    )}
                    {canManage && sprint.status === 'active' && (
                      <Button size="sm" variant="secondary" icon={<Square className="h-3.5 w-3.5" />} onClick={() => setCompleting(sprint)}>
                        Kết thúc
                      </Button>
                    )}
                    {canManage && (
                      <button type="button" aria-label={`Sửa ${sprint.name}`} onClick={() => setSprintForm(sprint)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-white">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canManage && sprint.status === 'planned' && (
                      <button type="button" aria-label={`Xóa ${sprint.name}`} onClick={() => setDeleting(sprint)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                  </span>
                  <span className="tabular-nums">
                    {sprint.stats.doneCount}/{sprint.stats.taskCount} việc · {sprint.stats.donePoints}/{sprint.stats.points} điểm
                  </span>
                  <Progress stats={sprint.stats} />
                  <CapacityLine sprintId={sprint.id} points={sprint.stats.points} />
                </div>
                {sprint.goal && (
                  <p className="mb-3 flex items-start gap-1.5 text-sm text-slate-600">
                    <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {sprint.goal}
                  </p>
                )}
                {tasks.length === 0 ? (
                  <p className="py-3 text-center text-sm text-slate-500">Chưa có việc nào. Chuyển việc từ backlog vào đây.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {tasks.map((t) => (
                      <BacklogRow key={t.id} task={t} canManage={canManage} sprints={openSprints} onMove={moveTask} />
                    ))}
                  </ul>
                )}
                {canManage && (
                  <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating({ type: 'task', sprintId: sprint.id })}>
                    Thêm công việc vào sprint
                  </Button>
                )}
              </Card>
            );
          })}

          <Card
            title={`Backlog (${data.backlog.filter(byEpic).length})`}
            action={
              <button type="button" aria-pressed={includeDone} onClick={() => setIncludeDone((v) => !v)} className={chipClass(includeDone)}>
                Hiện cả việc đã xong
              </button>
            }
          >
            {data.backlog.filter(byEpic).length === 0 ? (
              <p className="py-3 text-center text-sm text-slate-500">Backlog trống.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.backlog.filter(byEpic).map((t) => (
                  <BacklogRow key={t.id} task={t} canManage={canManage} sprints={openSprints} onMove={moveTask} />
                ))}
              </ul>
            )}
            {canManage && (
              <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating({ type: 'story' })}>
                Thêm vào backlog
              </Button>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Epic">
            {data.epics.length === 0 ? (
              <EmptyState title="Chưa có epic" description="Epic gom các story liên quan thành một mục tiêu lớn." />
            ) : (
              <ul className="space-y-2">
                {data.epics.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-pressed={epicFilter === e.id}
                      onClick={() => setEpicFilter((cur) => (cur === e.id ? null : e.id))}
                      className={clsx('w-full rounded-xl border p-3 text-left transition-colors', epicFilter === e.id ? 'border-white/40 bg-white/[0.06]' : 'border-white/[0.08] hover:border-white/20')}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{e.title}</span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="tabular-nums">
                          {e.stats.doneCount}/{e.stats.taskCount} việc
                        </span>
                        <Progress stats={e.stats} />
                      </span>
                    </button>
                    <Link to={`/tasks/${e.id}`} className="mt-0.5 block px-1 text-[11px] text-slate-500 hover:text-white">
                      Mở epic
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {epicFilter !== null && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEpicFilter(null)}>
                Bỏ lọc epic
              </Button>
            )}
          </Card>
        </aside>
      </div>

      {sprintForm !== null && <SprintFormModal projectId={project.id} sprint={sprintForm === 'new' ? undefined : sprintForm} onClose={() => setSprintForm(null)} />}
      {completing && <CompleteSprintModal sprint={completing} others={openSprints.filter((s) => s.id !== completing.id)} onClose={() => setCompleting(null)} />}
      {creating && <TaskFormModal open defaultProjectId={project.id} defaultType={creating.type} defaultSprintId={creating.sprintId} onClose={() => setCreating(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title="Xóa sprint"
        message={`Xóa "${deleting?.name ?? ''}"? Các việc trong sprint sẽ quay về backlog.`}
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          void act(() => remove.mutateAsync(deleting.id), 'Đã xóa sprint').finally(() => setDeleting(null));
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
