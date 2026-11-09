import { Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { AssigneeFilter } from '../components/assignees/AssigneeFilter';
import { TaskTable } from '../components/tasks/TaskTable';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useUsers';
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_META, TYPE_LABEL, TYPES } from '../lib/constants';
import { vnDateInputToEndOfDayIso, vnDateInputToIso } from '../lib/format';
import { inputClass } from '../lib/styles';
import type { Priority, StatusCategory, TaskFilters, TaskType } from '../types/api';

const PAGE_SIZE = 15;
const SORT_FIELDS: NonNullable<TaskFilters['sortBy']>[] = ['createdAt', 'updatedAt', 'deadline', 'priority', 'status', 'title'];
const SORT_LABEL: Record<string, string> = {
  createdAt: 'Ngày tạo',
  updatedAt: 'Cập nhật gần nhất',
  deadline: 'Deadline',
  priority: 'Mức ưu tiên',
  status: 'Trạng thái',
  title: 'Tiêu đề',
};

function asEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);
  const searchTimer = useRef<number | undefined>(undefined);

  const projectId = params.get('projectId') ?? '';
  // ?assigneeIds=1,2 (chọn nhiều người); chấp nhận cả ?assigneeId=1 của đường dẫn cũ
  const assigneeIds = (params.get('assigneeIds') ?? params.get('assigneeId') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const statusCategory = asEnum<StatusCategory>(params.get('statusCategory'), CATEGORIES);
  const type = asEnum<TaskType>(params.get('type'), TYPES);
  const priority = asEnum<Priority>(params.get('priority'), PRIORITIES);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const includeSubtasks = params.get('sub') === '1';
  const sortBy = asEnum(params.get('sortBy'), SORT_FIELDS) ?? 'createdAt';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = (changes: Record<string, string | null>, resetPage = true) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  // Debounce ô tìm kiếm trước khi đẩy lên URL
  const onSearchChange = (value: string) => {
    setSearchInput(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => update({ q: value.trim() }), 350);
  };
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const projectsQuery = useProjects();
  const usersQuery = useUsers({ isActive: true });
  const filters = {
    projectId: projectId ? Number(projectId) : undefined,
    assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
    statusCategory,
    types: type ? [type] : undefined,
    priority,
    deadlineFrom: from ? (vnDateInputToIso(from) ?? undefined) : undefined,
    deadlineTo: vnDateInputToEndOfDayIso(to),
    search: q || undefined,
    sortBy,
    order,
    page,
    pageSize: PAGE_SIZE,
    includeSubtasks: includeSubtasks || undefined,
  } satisfies TaskFilters & { includeSubtasks?: boolean };
  const tasksQuery = useTasks(filters);

  const hasFilters = Boolean(q || projectId || assigneeIds.length > 0 || statusCategory || type || priority || from || to || includeSubtasks);

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchInput('');
    setParams({}, { replace: true });
  };

  const toggleSort = (key: NonNullable<TaskFilters['sortBy']>) => {
    if (key === sortBy) update({ order: order === 'asc' ? 'desc' : 'asc' }, false);
    else update({ sortBy: key, order: 'asc' }, false);
  };

  return (
    <>
      <PageHeader
        title="Công việc"
        description="Tìm kiếm, lọc và theo dõi mọi công việc"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Tạo công việc
          </Button>
        }
      />

      <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={searchInput} onChange={(e) => onSearchChange(e.target.value)} placeholder="Tìm theo tiêu đề hoặc mô tả..." className={`${inputClass} pl-9`} aria-label="Tìm công việc" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select aria-label="Dự án" value={projectId} onChange={(e) => update({ projectId: e.target.value })} className={inputClass}>
            <option value="">Tất cả dự án</option>
            {projectsQuery.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <AssigneeFilter
            users={usersQuery.data?.items ?? []}
            value={assigneeIds}
            onChange={(ids) => update({ assigneeIds: ids.join(','), assigneeId: null })}
          />
          <select aria-label="Trạng thái" value={statusCategory ?? ''} onChange={(e) => update({ statusCategory: e.target.value })} className={inputClass}>
            <option value="">Mọi trạng thái</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select aria-label="Loại công việc" value={type ?? ''} onChange={(e) => update({ type: e.target.value })} className={inputClass}>
            <option value="">Mọi loại</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select aria-label="Mức ưu tiên" value={priority ?? ''} onChange={(e) => update({ priority: e.target.value })} className={inputClass}>
            <option value="">Mọi mức ưu tiên</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Deadline từ
            <input type="date" value={from} onChange={(e) => update({ from: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            đến
            <input type="date" value={to} onChange={(e) => update({ to: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Sắp xếp
            <div className="mt-1 flex gap-2">
              <select aria-label="Sắp xếp theo" value={sortBy} onChange={(e) => update({ sortBy: e.target.value }, false)} className={inputClass}>
                {SORT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {SORT_LABEL[f]}
                  </option>
                ))}
              </select>
              <select aria-label="Thứ tự" value={order} onChange={(e) => update({ order: e.target.value }, false)} className={inputClass}>
                <option value="asc">Tăng dần</option>
                <option value="desc">Giảm dần</option>
              </select>
            </div>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={includeSubtasks} onChange={(e) => update({ sub: e.target.checked ? '1' : null })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Gồm công việc con
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={clearFilters} className="mb-1 ml-auto">
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <PageLoader />
      ) : tasksQuery.isError ? (
        <ErrorState error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />
      ) : tasksQuery.data && tasksQuery.data.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Không có công việc phù hợp bộ lọc' : 'Chưa có công việc nào'}
          description={hasFilters ? 'Thử nới lỏng hoặc xóa bộ lọc.' : undefined}
          action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Xóa bộ lọc</Button> : undefined}
        />
      ) : (
        tasksQuery.data && (
          <div className={tasksQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
            <TaskTable tasks={tasksQuery.data.items} sortBy={sortBy} order={order} onSort={toggleSort} />
            <Pagination page={tasksQuery.data.page} totalPages={tasksQuery.data.totalPages} total={tasksQuery.data.total} onChange={(p) => update({ page: String(p) }, false)} />
          </div>
        )
      )}

      {creating && <TaskFormModal open onClose={() => setCreating(false)} defaultProjectId={projectId ? Number(projectId) : undefined} />}
    </>
  );
}
