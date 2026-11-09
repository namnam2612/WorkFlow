import { useState } from 'react';
import { getErrorMessage } from '../../lib/api';
import { isoToVnDateInput, vnDateInputToEndOfDayIso, vnDateInputToIso } from '../../lib/format';
import { inputClass } from '../../lib/styles';
import { useCreateSprint, useUpdateSprint } from '../../hooks/useSprints';
import type { Sprint } from '../../types/api';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Tạo hoặc sửa sprint: tên, mục tiêu, ngày bắt đầu/kết thúc (giờ Việt Nam) */
export function SprintFormModal({ projectId, sprint, onClose }: { projectId: number; sprint?: Sprint; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateSprint(projectId);
  const update = useUpdateSprint();
  const [name, setName] = useState(sprint?.name ?? '');
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [start, setStart] = useState(isoToVnDateInput(sprint?.startDate));
  const [end, setEnd] = useState(isoToVnDateInput(sprint?.endDate));
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim() === '') return setError('Vui lòng nhập tên sprint');
    if (start && end && end < start) return setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    const input = { name: name.trim(), goal: goal.trim() || null, startDate: vnDateInputToIso(start), endDate: vnDateInputToEndOfDayIso(end) ?? null };
    try {
      if (sprint) await update.mutateAsync({ id: sprint.id, ...input });
      else await create.mutateAsync(input);
      toast.show(sprint ? 'Đã cập nhật sprint' : 'Đã tạo sprint', 'success');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={sprint ? 'Sửa sprint' : 'Tạo sprint'}>
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <InlineError message={error} />
        <Field label="Tên sprint" htmlFor="sprint-name">
          <input id="sprint-name" autoFocus className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="VD: Sprint 12" />
        </Field>
        <Field label="Mục tiêu" htmlFor="sprint-goal">
          <textarea id="sprint-goal" rows={3} className={inputClass} value={goal} maxLength={2000} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bắt đầu" htmlFor="sprint-start">
            <input id="sprint-start" type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Kết thúc" htmlFor="sprint-end">
            <input id="sprint-end" type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Để trống ngày thì khi bắt đầu sprint sẽ lấy hôm nay và kéo dài 14 ngày.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={busy}>
            {sprint ? 'Lưu' : 'Tạo sprint'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
