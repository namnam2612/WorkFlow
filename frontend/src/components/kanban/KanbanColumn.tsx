import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { STATUS_META } from '../../lib/constants';
import { columnDroppableId } from '../../lib/kanban';
import type { Task, TaskStatus } from '../../types/api';
import { KanbanCard } from './KanbanCard';

function SortableCard({ task, canDrag }: { task: Task; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canDrag });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx('touch-manipulation', !canDrag && 'cursor-default')}
    >
      <KanbanCard task={task} dimmed={isDragging} locked={!canDrag} />
    </div>
  );
}

interface KanbanColumnProps {
  status: TaskStatus;
  /** Toàn bộ task của cột (không lọc) — dùng để tính tổng */
  totalCount: number;
  /** Task đang hiển thị (đã lọc) */
  tasks: Task[];
  canDrag: (task: Task) => boolean;
  onAdd?: () => void;
}

export function KanbanColumn({ status, totalCount, tasks, canDrag, onAdd }: KanbanColumnProps) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(status) });

  return (
    <section className="flex w-[288px] shrink-0 flex-col rounded-xl bg-slate-100/80 lg:w-auto lg:min-w-0 lg:flex-1" aria-label={meta.label}>
      <header className={clsx('flex items-center justify-between rounded-t-xl border-t-4 px-3 py-2.5', meta.column)}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">{meta.label}</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm">
            {tasks.length === totalCount ? totalCount : `${tasks.length}/${totalCount}`}
          </span>
        </div>
        {onAdd && (
          <button type="button" onClick={onAdd} aria-label={`Thêm công việc vào cột ${meta.label}`} className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={clsx('thin-scroll flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl p-2 transition-colors', isOver && 'bg-brand-50/70')}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} canDrag={canDrag(task)} />
          ))}
          {tasks.length === 0 && <p className="m-auto py-6 text-center text-xs text-slate-400">Chưa có công việc</p>}
        </div>
      </SortableContext>
    </section>
  );
}
