import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, CATEGORY_LABEL } from '../../lib/constants';
import { getErrorMessage } from '../../lib/api';
import { chipClass, inputClass } from '../../lib/styles';
import { statusesOf, useCreateStatus, useDeleteStatus, useProjectStatuses, useReorderStatuses, useUpdateStatus } from '../../hooks/useStatuses';
import type { ProjectStatus, StatusCategory, StatusScope } from '../../types/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

const PALETTE = ['#64748b', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#14b8a6'];

function StatusRow({ status, siblings, index, onError, projectId }: { status: ProjectStatus; siblings: ProjectStatus[]; index: number; onError: (message: string) => void; projectId: number }) {
  const update = useUpdateStatus(projectId);
  const remove = useDeleteStatus(projectId);
  const reorder = useReorderStatuses(projectId);
  const [name, setName] = useState(status.name);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const others = siblings.filter((s) => s.id !== status.id);

  const run = async (action: () => Promise<unknown>) => {
    onError('');
    try {
      await action();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };
  const swap = (delta: -1 | 1) => {
    const ids = siblings.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as number, ids[index] as number];
    void run(() => reorder.mutateAsync({ scope: status.scope, ids }));
  };

  return (
    <li className="rounded-xl border border-white/[0.08] bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" aria-label={`Màu của ${status.name}`} value={status.color} onChange={(e) => void run(() => update.mutateAsync({ id: status.id, color: e.target.value }))} className="h-9 w-9 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent p-0.5" />
        <input
          aria-label="Tên trạng thái"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next === '') setName(status.name);
            else if (next !== status.name) void run(() => update.mutateAsync({ id: status.id, name: next }));
          }}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select aria-label="Nhóm trạng thái" value={status.category} onChange={(e) => void run(() => update.mutateAsync({ id: status.id, category: e.target.value as StatusCategory }))} className={`${inputClass} w-auto!`}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Chuyển lên" disabled={index === 0} onClick={() => swap(-1)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-white disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Chuyển xuống" disabled={index === siblings.length - 1} onClick={() => swap(1)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-white disabled:opacity-30">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" aria-label={`Xóa trạng thái ${status.name}`} onClick={() => setDeleting((v) => !v)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {deleting && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-3 text-sm text-slate-600">
          <span>Chuyển các công việc đang ở đây sang:</span>
          <select aria-label="Trạng thái thay thế" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">— Chọn —</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => void run(() => remove.mutateAsync({ id: status.id, moveTo: moveTo ? Number(moveTo) : undefined }))}>
            Xóa
          </Button>
        </div>
      )}
    </li>
  );
}

/** Tùy chỉnh cột Kanban của dự án: tên, màu, nhóm, thứ tự; hai bộ riêng cho công việc và Bug */
export function StatusManagerModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const query = useProjectStatuses(projectId);
  const create = useCreateStatus(projectId);
  const [scope, setScope] = useState<StatusScope>('task');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[1] ?? '#3b82f6');
  const [category, setCategory] = useState<StatusCategory>('in_progress');
  const list = statusesOf(query.data, scope);

  const add = async () => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    setError('');
    try {
      await create.mutateAsync({ scope, name: trimmed, color, category });
      setName('');
      toast.show('Đã thêm trạng thái', 'success');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title="Tùy chỉnh cột Kanban" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Mỗi nhóm cho hệ thống biết trạng thái nào là "chưa làm", "đang làm" hay "hoàn thành" (để tính tiến độ, quá hạn). Bug có bộ trạng thái riêng.
        </p>
        <div className="flex gap-2" role="group" aria-label="Bộ trạng thái">
          <button type="button" aria-pressed={scope === 'task'} onClick={() => setScope('task')} className={chipClass(scope === 'task')}>
            Công việc
          </button>
          <button type="button" aria-pressed={scope === 'bug'} onClick={() => setScope('bug')} className={chipClass(scope === 'bug')}>
            Bug
          </button>
        </div>
        <InlineError message={error || null} />
        <ul className="space-y-2">
          {list.map((s, index) => (
            <StatusRow key={`${s.id}-${s.name}-${s.color}-${s.category}`} status={s} siblings={list} index={index} onError={setError} projectId={projectId} />
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
          <input type="color" aria-label="Màu trạng thái mới" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent p-0.5" />
          <input aria-label="Tên trạng thái mới" placeholder="Tên trạng thái mới" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} className={`${inputClass} min-w-0 flex-1`} />
          <select aria-label="Nhóm của trạng thái mới" value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)} className={`${inputClass} w-auto!`}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <Button icon={<Plus className="h-4 w-4" />} loading={create.isPending} onClick={() => void add()}>
            Thêm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
