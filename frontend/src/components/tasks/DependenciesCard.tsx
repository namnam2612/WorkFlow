import { Link2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '../../hooks/useTasks';
import { api, getErrorMessage } from '../../lib/api';
import { inputClass } from '../../lib/styles';
import type { TaskDetail } from '../../types/api';
import { StatusBadge } from '../ui/Badges';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../ui/useToast';

/** Phụ thuộc "kết thúc → bắt đầu": việc này phải chờ những việc nào xong, và đang chặn những việc nào */
export function DependenciesCard({ task, canManage }: { task: TaskDetail; canManage: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const candidates = useTasks({ projectId: task.projectId, pageSize: 100, includeSubtasks: true, sortBy: 'title', order: 'asc' }, canManage);

  const taken = new Set([task.id, ...task.dependsOn.map((d) => d.id)]);
  const options = (candidates.data?.items ?? []).filter((t) => !taken.has(t.id) && t.type !== 'epic');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all(['task', 'gantt', 'activity'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (task.type === 'epic') return null;
  if (!canManage && task.dependsOn.length === 0 && task.blocking.length === 0) return null;
  return (
    <Card title="Phụ thuộc" action={<Link2 className="h-4 w-4 text-slate-400" aria-hidden />}>
      <div className="space-y-4">
        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-[1px] text-slate-500">Phải chờ ({task.dependsOn.length})</h3>
          {task.dependsOn.length === 0 ? (
            <p className="text-sm text-slate-500">Không phụ thuộc việc nào.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {task.dependsOn.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <Link to={`/tasks/${d.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                    {d.title}
                  </Link>
                  <StatusBadge status={d.status} />
                  {canManage && (
                    <button type="button" aria-label={`Bỏ phụ thuộc ${d.title}`} disabled={busy} onClick={() => void run(() => api.delete(`/tasks/${task.id}/dependencies/${d.id}`))} className="rounded-md p-1 text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="mt-2 flex gap-2">
              <select aria-label="Chọn việc phải chờ" value={selected} onChange={(e) => setSelected(e.target.value)} className={`${inputClass} min-w-0 flex-1`}>
                <option value="">— Thêm việc phải chờ —</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <Button disabled={!selected} loading={busy} onClick={() => void run(() => api.post(`/tasks/${task.id}/dependencies`, { dependsOnId: Number(selected) })).then(() => setSelected(''))}>
                Thêm
              </Button>
            </div>
          )}
        </section>
        {task.blocking.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-[1px] text-slate-500">Đang chặn ({task.blocking.length})</h3>
            <ul className="divide-y divide-slate-100">
              {task.blocking.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <Link to={`/tasks/${d.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                    {d.title}
                  </Link>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Card>
  );
}
