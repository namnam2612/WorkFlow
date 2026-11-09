import { useState } from 'react';
import { getErrorMessage } from '../../lib/api';
import { inputClass } from '../../lib/styles';
import { useCompleteSprint } from '../../hooks/useSprints';
import type { SprintWithStats } from '../../types/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Kết thúc sprint: chọn nơi đưa các việc chưa xong (backlog hoặc sprint kế tiếp) */
export function CompleteSprintModal({ sprint, others, onClose }: { sprint: SprintWithStats; others: SprintWithStats[]; onClose: () => void }) {
  const toast = useToast();
  const complete = useCompleteSprint();
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const open = sprint.stats.taskCount - sprint.stats.doneCount;

  const submit = async () => {
    try {
      await complete.mutateAsync({ id: sprint.id, moveIncompleteTo: target ? Number(target) : null });
      toast.show(`Đã kết thúc ${sprint.name}`, 'success');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={`Kết thúc ${sprint.name}`}>
      <div className="space-y-4">
        <InlineError message={error} />
        <p className="text-sm text-slate-600">
          Đã xong {sprint.stats.doneCount}/{sprint.stats.taskCount} việc ({sprint.stats.donePoints}/{sprint.stats.points} điểm). Điểm đã xong sẽ được ghi vào velocity của dự án.
        </p>
        {open > 0 ? (
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-700">{open} việc chưa xong sẽ được chuyển tới:</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} aria-label="Nơi chuyển việc chưa xong">
              <option value="">Backlog</option>
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-emerald-600">Mọi việc trong sprint đã hoàn thành.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={complete.isPending} onClick={() => void submit()}>
            Kết thúc sprint
          </Button>
        </div>
      </div>
    </Modal>
  );
}
