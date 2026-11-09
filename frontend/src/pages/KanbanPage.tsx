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
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { KanbanCard } from '../components/kanban/KanbanCard';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { Button } from '../components/ui/Button';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useProject } from '../hooks/useProjects';
import { useBoard, useMoveTask } from '../hooks/useTasks';
import { getErrorMessage } from '../lib/api';
import { PRIORITIES, PRIORITY_META, STATUSES } from '../lib/constants';
import { columnDroppableId } from '../lib/kanban';
import { canManageProject } from '../lib/permissions';
import { inputClass } from '../lib/styles';
import type { Priority, Task, TaskStatus } from '../types/api';

type Columns = Record<TaskStatus, Task[]>;

const emptyColumns = (): Columns => ({ todo: [], in_progress: [], review: [], done: [], blocked: [] });

function groupByStatus(tasks: Task[]): Columns {
  const columns = emptyColumns();
  for (const task of [...tasks].sort((a, b) => a.position - b.position || a.id - b.id)) columns[task.status].push(task);
  return columns;
}

const flatten = (columns: Columns): Task[] => STATUSES.flatMap((status) => columns[status].map((task, index) => ({ ...task, status, position: index })));

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

  const [columns, setColumns] = useState<Columns>(emptyColumns);
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragStart = useRef<{ status: TaskStatus; index: number } | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null);

  // Đồng bộ state cục bộ với dữ liệu server (trừ lúc đang kéo)
  useEffect(() => {
    if (boardQuery.data && activeId === null) setColumns(groupByStatus(boardQuery.data));
  }, [boardQuery.data, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const project = projectQuery.data;
  const canManage = canManageProject(user, project);
  const canDrag = (task: Task) => canManage || task.assigneeId === user?.id;

  const visible = useMemo(() => {
    const matches = (task: Task) =>
      (assigneeFilter === '' || (assigneeFilter === 'none' ? task.assigneeId === null : task.assigneeId === Number(assigneeFilter))) &&
      (priorityFilter === '' || task.priority === priorityFilter);
    const result = emptyColumns();
    for (const status of STATUSES) result[status] = columns[status].filter(matches);
    return result;
  }, [columns, assigneeFilter, priorityFilter]);

  const findContainer = (itemId: UniqueIdentifier): TaskStatus | undefined => {
    if (isColumnId(itemId)) return STATUSES.find((s) => columnDroppableId(s) === itemId);
    return STATUSES.find((s) => columns[s].some((t) => t.id === itemId));
  };

  const activeTask = activeId === null ? null : (STATUSES.flatMap((s) => columns[s]).find((t) => t.id === activeId) ?? null);

  const onDragStart = (event: DragStartEvent) => {
    const taskId = Number(event.active.id);
    const status = findContainer(taskId);
    if (!status) return;
    dragStart.current = { status, index: columns[status].findIndex((t) => t.id === taskId) };
    setActiveId(taskId);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const moved = prev[from].find((t) => t.id === active.id);
      if (!moved) return prev;
      const target = prev[to];
      let index = target.length;
      if (!isColumnId(over.id)) {
        const overIndex = target.findIndex((t) => t.id === over.id);
        const translated = active.rect.current.translated;
        const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== active.id),
        [to]: [...target.slice(0, index), { ...moved, status: to }, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const start = dragStart.current;
    dragStart.current = null;
    setActiveId(null);

    if (!over || !start) {
      if (boardQuery.data) setColumns(groupByStatus(boardQuery.data));
      return;
    }
    const container = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (!container || !overContainer) return;

    let next = columns;
    if (container === overContainer && !isColumnId(over.id) && active.id !== over.id) {
      const oldIndex = columns[container].findIndex((t) => t.id === active.id);
      const newIndex = columns[container].findIndex((t) => t.id === over.id);
      next = { ...columns, [container]: arrayMove(columns[container], oldIndex, newIndex) };
      setColumns(next);
    }

    const finalIndex = next[container].findIndex((t) => t.id === active.id);
    if (container === start.status && finalIndex === start.index) return;
    move.mutate({ id: Number(active.id), status: container, position: finalIndex, optimistic: flatten(next) });
  };

  const onDragCancel = () => {
    dragStart.current = null;
    setActiveId(null);
    if (boardQuery.data) setColumns(groupByStatus(boardQuery.data));
  };

  if (projectQuery.isLoading || boardQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !project) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (boardQuery.isError) return <ErrorState error={boardQuery.error} onRetry={() => void boardQuery.refetch()} />;

  const hasFilter = assigneeFilter !== '' || priorityFilter !== '';

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
          <select aria-label="Lọc theo người thực hiện" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">Mọi người</option>
            <option value="none">Chưa giao</option>
            {project.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
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
                setAssigneeFilter('');
                setPriorityFilter('');
              }}
            >
              Xóa lọc
            </Button>
          )}
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreatingIn('todo')}>
              Thêm công việc
            </Button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="flex gap-3 overflow-x-auto pb-4 lg:overflow-visible" style={{ minHeight: '60vh' }}>
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={visible[status]}
              totalCount={columns[status].length}
              canDrag={canDrag}
              onAdd={canManage ? () => setCreatingIn(status) : undefined}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <KanbanCard task={activeTask} overlay /> : null}</DragOverlay>
      </DndContext>

      {creatingIn && <TaskFormModal open defaultProjectId={project.id} defaultStatus={creatingIn} onClose={() => setCreatingIn(null)} />}
    </>
  );
}
