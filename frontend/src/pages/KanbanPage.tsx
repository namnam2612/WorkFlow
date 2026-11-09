import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft, Plus, Settings2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AssigneeFilter } from '../components/assignees/AssigneeFilter';
import { KanbanCard } from '../components/kanban/KanbanCard';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import { StatusManagerModal } from '../components/projects/StatusManagerModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { Button } from '../components/ui/Button';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useProject } from '../hooks/useProjects';
import { statusesOf, useProjectStatuses } from '../hooks/useStatuses';
import { useBoard, useMoveTask } from '../hooks/useTasks';
import { getErrorMessage } from '../lib/api';
import { PRIORITIES, PRIORITY_META } from '../lib/constants';
import { columnDroppableId } from '../lib/kanban';
import { canManageProject, isAssignee } from '../lib/permissions';
import { chipClass, inputClass } from '../lib/styles';
import type { Priority, ProjectStatus, StatusScope, Task } from '../types/api';

/** Cột Kanban theo id trạng thái của dự án (mỗi dự án có bộ cột riêng) */
type Columns = Record<number, Task[]>;

function groupByStatus(tasks: Task[], statuses: ProjectStatus[]): Columns {
  const columns: Columns = Object.fromEntries(statuses.map((s) => [s.id, [] as Task[]]));
  for (const task of [...tasks].sort((a, b) => a.position - b.position || a.id - b.id)) columns[task.statusId]?.push(task);
  return columns;
}

/** Task sau kéo thả: gán lại trạng thái và vị trí theo cột */
const flatten = (columns: Columns, statuses: ProjectStatus[]): Task[] =>
  statuses.flatMap((s) => (columns[s.id] ?? []).map((task, index) => ({ ...task, statusId: s.id, status: { id: s.id, name: s.name, color: s.color, category: s.category, scope: s.scope }, position: index })));

function isColumnId(id: UniqueIdentifier): id is string {
  return typeof id === 'string' && id.startsWith('column:');
}

export default function KanbanPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { user } = useAuth();
  const toast = useToast();

  const projectQuery = useProject(projectId);
  const boardQuery = useBoard(projectId);
  const move = useMoveTask(projectId, (error) => toast.show(`Không thể di chuyển: ${getErrorMessage(error)}`, 'error'));

  const statusesQuery = useProjectStatuses(projectId);
  const [scope, setScope] = useState<StatusScope>('task');
  const [managingStatuses, setManagingStatuses] = useState(false);
  const statuses = useMemo(() => statusesOf(statusesQuery.data, scope), [statusesQuery.data, scope]);
  // Task của bộ đang xem (công việc hoặc Bug); task thuộc bộ kia giữ nguyên khi cập nhật cache
  const scopeTasks = useMemo(() => (boardQuery.data ?? []).filter((t) => t.status.scope === scope), [boardQuery.data, scope]);
  const otherTasks = useMemo(() => (boardQuery.data ?? []).filter((t) => t.status.scope !== scope), [boardQuery.data, scope]);
  const bugCount = useMemo(() => (boardQuery.data ?? []).filter((t) => t.status.scope === 'bug').length, [boardQuery.data]);

  const [columns, setColumns] = useState<Columns>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragStart = useRef<{ statusId: number; index: number } | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<number[]>([]);
  const [unassignedFilter, setUnassignedFilter] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [creatingIn, setCreatingIn] = useState<number | null>(null);

  // Đồng bộ state cục bộ với dữ liệu server (trừ lúc đang kéo)
  useEffect(() => {
    if (boardQuery.data && statusesQuery.data && activeId === null) setColumns(groupByStatus(scopeTasks, statuses));
  }, [boardQuery.data, statusesQuery.data, scopeTasks, statuses, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const project = projectQuery.data;
  const canManage = canManageProject(user, project);
  const canDrag = (task: Task) => canManage || isAssignee(user, task);

  const visible = useMemo(() => {
    // Lọc người: task có BẤT KỲ người nào được chọn, hoặc "Chưa giao" khi task không có ai
    const byAssignee = (task: Task) =>
      (assigneeFilter.length === 0 && !unassignedFilter) ||
      task.assignees.some((a) => assigneeFilter.includes(a.id)) ||
      (unassignedFilter && task.assignees.length === 0);
    const matches = (task: Task) => byAssignee(task) && (priorityFilter === '' || task.priority === priorityFilter);
    const result: Columns = {};
    for (const s of statuses) result[s.id] = (columns[s.id] ?? []).filter(matches);
    return result;
  }, [columns, statuses, assigneeFilter, unassignedFilter, priorityFilter]);

  const findContainer = (itemId: UniqueIdentifier): number | undefined => {
    const ids = statuses.map((s) => s.id);
    if (isColumnId(itemId)) return ids.find((sid) => columnDroppableId(sid) === itemId);
    return ids.find((sid) => (columns[sid] ?? []).some((t) => t.id === itemId));
  };

  const activeTask = activeId === null ? null : (statuses.flatMap((s) => columns[s.id] ?? []).find((t) => t.id === activeId) ?? null);

  const onDragStart = (event: DragStartEvent) => {
    const taskId = Number(event.active.id);
    const statusId = findContainer(taskId);
    if (statusId === undefined) return;
    dragStart.current = { statusId, index: (columns[statusId] ?? []).findIndex((t) => t.id === taskId) };
    setActiveId(taskId);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (from === undefined || to === undefined || from === to) return;

    setColumns((prev) => {
      const moved = (prev[from] ?? []).find((t) => t.id === active.id);
      if (!moved) return prev;
      const target = prev[to] ?? [];
      let index = target.length;
      if (!isColumnId(over.id)) {
        const overIndex = target.findIndex((t) => t.id === over.id);
        const translated = active.rect.current.translated;
        const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      return {
        ...prev,
        [from]: (prev[from] ?? []).filter((t) => t.id !== active.id),
        [to]: [...target.slice(0, index), { ...moved, statusId: to }, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const start = dragStart.current;
    dragStart.current = null;
    setActiveId(null);

    if (!over || !start) {
      setColumns(groupByStatus(scopeTasks, statuses));
      return;
    }
    const container = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (container === undefined || overContainer === undefined) return;

    let next = columns;
    const column = columns[container] ?? [];
    if (container === overContainer && !isColumnId(over.id) && active.id !== over.id) {
      const oldIndex = column.findIndex((t) => t.id === active.id);
      const newIndex = column.findIndex((t) => t.id === over.id);
      next = { ...columns, [container]: arrayMove(column, oldIndex, newIndex) };
      setColumns(next);
    }

    const finalIndex = (next[container] ?? []).findIndex((t) => t.id === active.id);
    if (container === start.statusId && finalIndex === start.index) return;
    move.mutate({ id: Number(active.id), statusId: container, position: finalIndex, optimistic: [...otherTasks, ...flatten(next, statuses)] });
  };

  const onDragCancel = () => {
    dragStart.current = null;
    setActiveId(null);
    setColumns(groupByStatus(scopeTasks, statuses));
  };

  if (projectQuery.isLoading || boardQuery.isLoading || statusesQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !project) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (boardQuery.isError) return <ErrorState error={boardQuery.error} onRetry={() => void boardQuery.refetch()} />;
  if (statusesQuery.isError) return <ErrorState error={statusesQuery.error} onRetry={() => void statusesQuery.refetch()} />;

  const hasFilter = assigneeFilter.length > 0 || unassignedFilter || priorityFilter !== '';

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Bảng Kanban</h1>
          <p className="text-sm text-slate-500">Kéo thả thẻ để đổi trạng thái và thứ tự{!canManage && ' (bạn chỉ kéo được công việc của mình)'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssigneeFilter
            users={project.members}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            unassigned={unassignedFilter}
            onUnassignedChange={setUnassignedFilter}
            className="w-56"
          />
          <select aria-label="Lọc theo ưu tiên" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | '')} className={`${inputClass} w-auto!`}>
            <option value="">Mọi ưu tiên</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="h-4 w-4" />}
              onClick={() => {
                setAssigneeFilter([]);
                setUnassignedFilter(false);
                setPriorityFilter('');
              }}
            >
              Xóa lọc
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" icon={<Settings2 className="h-4 w-4" />} onClick={() => setManagingStatuses(true)}>
              Tùy chỉnh cột
            </Button>
          )}
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreatingIn(statuses[0]?.id ?? null)}>
              {scope === 'bug' ? 'Thêm Bug' : 'Thêm công việc'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 inline-flex gap-2" role="group" aria-label="Bộ cột">
        <button type="button" aria-pressed={scope === 'task'} onClick={() => setScope('task')} className={chipClass(scope === 'task')}>
          Công việc
        </button>
        <button type="button" aria-pressed={scope === 'bug'} onClick={() => setScope('bug')} className={chipClass(scope === 'bug')}>
          Bug{bugCount > 0 ? ` (${bugCount})` : ''}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="flex gap-3 overflow-x-auto pb-4 lg:overflow-visible" style={{ minHeight: '60vh' }}>
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={visible[status.id] ?? []}
              totalCount={(columns[status.id] ?? []).length}
              canDrag={canDrag}
              onAdd={canManage ? () => setCreatingIn(status.id) : undefined}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <KanbanCard task={activeTask} overlay /> : null}</DragOverlay>
      </DndContext>

      {creatingIn !== null && <TaskFormModal open defaultProjectId={project.id} defaultStatusId={creatingIn} defaultType={scope === 'bug' ? 'bug' : 'task'} onClose={() => setCreatingIn(null)} />}
      {managingStatuses && <StatusManagerModal projectId={project.id} onClose={() => setManagingStatuses(false)} />}
    </>
  );
}
