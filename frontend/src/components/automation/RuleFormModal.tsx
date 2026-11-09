import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCreateAutomation, useUpdateAutomation } from '../../hooks/useAutomations';
import { statusesOf, useProjectStatuses } from '../../hooks/useStatuses';
import { getErrorMessage } from '../../lib/api';
import { PRIORITIES, PRIORITY_META, TRIGGER_LABEL, TYPES, TYPE_LABEL } from '../../lib/constants';
import { inputClass } from '../../lib/styles';
import type { AutomationAction, AutomationRule, AutomationTrigger, Priority, ProjectDetail, TaskType } from '../../types/api';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

const ACTION_LABEL: Record<AutomationAction['type'], string> = {
  set_status: 'Đổi trạng thái',
  assign: 'Giao việc cho',
  set_priority: 'Đổi mức ưu tiên',
  add_comment: 'Thêm bình luận',
  notify: 'Gửi thông báo',
};

const blank = (type: AutomationAction['type']): AutomationAction => {
  switch (type) {
    case 'set_status':
      return { type, statusId: 0 };
    case 'assign':
      return { type, userIds: [] };
    case 'set_priority':
      return { type, priority: 'high' };
    case 'add_comment':
      return { type, text: '' };
    case 'notify':
      return { type, toLeader: true, message: '' };
  }
};

/** Tạo/sửa quy tắc: sự kiện + điều kiện + danh sách hành động. Văn bản có thể dùng {{title}}, {{status}}, {{user}}, {{project}}. */
export function RuleFormModal({ project, rule, onClose }: { project: ProjectDetail; rule?: AutomationRule; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateAutomation(project.id);
  const update = useUpdateAutomation();
  const statuses = useProjectStatuses(project.id);
  const [name, setName] = useState(rule?.name ?? '');
  const [trigger, setTrigger] = useState<AutomationTrigger>(rule?.trigger ?? 'status_changed');
  const [statusId, setStatusId] = useState(rule?.conditions.statusId ? String(rule.conditions.statusId) : '');
  const [type, setType] = useState<TaskType | ''>(rule?.conditions.type ?? '');
  const [priority, setPriority] = useState<Priority | ''>(rule?.conditions.priority ?? '');
  const [actions, setActions] = useState<AutomationAction[]>(rule?.actions ?? [blank('notify')]);
  const [error, setError] = useState<string | null>(null);

  const all = [...statusesOf(statuses.data, 'task').map((s) => ({ ...s, label: s.name })), ...statusesOf(statuses.data, 'bug').map((s) => ({ ...s, label: `${s.name} (Bug)` }))];
  const setAction = (i: number, next: AutomationAction) => setActions((cur) => cur.map((a, idx) => (idx === i ? next : a)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Vui lòng đặt tên cho quy tắc');
    const input = {
      name: name.trim(),
      trigger,
      conditions: { ...(statusId ? { statusId: Number(statusId) } : {}), ...(type ? { type } : {}), ...(priority ? { priority } : {}) },
      actions,
    };
    try {
      if (rule) await update.mutateAsync({ id: rule.id, ...input });
      else await create.mutateAsync(input);
      toast.show(rule ? 'Đã cập nhật quy tắc' : 'Đã tạo quy tắc', 'success');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={rule ? 'Sửa quy tắc' : 'Tạo quy tắc tự động'} size="lg">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5">
        <InlineError message={error} />
        <Field label="Tên quy tắc" htmlFor="rule-name">
          <input id="rule-name" autoFocus className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="VD: Bug khẩn cấp báo ngay cho trưởng nhóm" />
        </Field>

        <section className="space-y-3 rounded-xl border border-white/[0.08] p-4">
          <h3 className="text-xs font-medium uppercase tracking-[1px] text-slate-500">Khi nào</h3>
          <select aria-label="Sự kiện" className={inputClass} value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
            {(Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABEL[t]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">Và (không bắt buộc) công việc phải thỏa:</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select aria-label="Điều kiện trạng thái" className={inputClass} value={statusId} onChange={(e) => setStatusId(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              {all.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select aria-label="Điều kiện loại" className={inputClass} value={type} onChange={(e) => setType(e.target.value as TaskType | '')}>
              <option value="">Mọi loại</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select aria-label="Điều kiện ưu tiên" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
              <option value="">Mọi mức ưu tiên</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-white/[0.08] p-4">
          <h3 className="text-xs font-medium uppercase tracking-[1px] text-slate-500">Thì làm</h3>
          {actions.map((a, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-white/[0.06] p-3">
              <div className="flex gap-2">
                <select
                  aria-label={`Hành động ${i + 1}`}
                  className={inputClass}
                  value={a.type}
                  onChange={(e) => setAction(i, blank(e.target.value as AutomationAction['type']))}
                >
                  {(Object.keys(ACTION_LABEL) as AutomationAction['type'][]).map((t) => (
                    <option key={t} value={t}>
                      {ACTION_LABEL[t]}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label={`Xóa hành động ${i + 1}`} disabled={actions.length === 1} onClick={() => setActions((cur) => cur.filter((_, idx) => idx !== i))} className="rounded-md p-2 text-red-500 hover:bg-red-50 disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {a.type === 'set_status' && (
                <select aria-label="Trạng thái đích" className={inputClass} value={a.statusId || ''} onChange={(e) => setAction(i, { ...a, statusId: Number(e.target.value) })}>
                  <option value="">— Chọn trạng thái —</option>
                  {all.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
              {a.type === 'set_priority' && (
                <select aria-label="Mức ưu tiên đích" className={inputClass} value={a.priority} onChange={(e) => setAction(i, { ...a, priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              )}
              {a.type === 'assign' && (
                <div className="max-h-32 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {project.members.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={a.userIds.includes(m.id)} onChange={() => setAction(i, { ...a, userIds: a.userIds.includes(m.id) ? a.userIds.filter((x) => x !== m.id) : [...a.userIds, m.id] })} className="h-4 w-4 rounded border-slate-300" />
                      {m.name}
                    </label>
                  ))}
                </div>
              )}
              {a.type === 'add_comment' && <textarea aria-label="Nội dung bình luận" rows={2} className={inputClass} maxLength={2000} value={a.text} onChange={(e) => setAction(i, { ...a, text: e.target.value })} placeholder={'VD: {{user}} đã chuyển "{{title}}" sang {{status}}'} />}
              {a.type === 'notify' && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={a.toLeader === true} onChange={(e) => setAction(i, { ...a, toLeader: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    Báo cho trưởng nhóm dự án
                  </label>
                  <input aria-label="Nội dung thông báo" className={inputClass} maxLength={400} value={a.message} onChange={(e) => setAction(i, { ...a, message: e.target.value })} placeholder={'VD: Việc khẩn cấp mới: {{title}}'} />
                </>
              )}
            </div>
          ))}
          {actions.length < 6 && (
            <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setActions((cur) => [...cur, blank('set_priority')])}>
              Thêm hành động
            </Button>
          )}
          <p className="text-xs text-slate-500">Quy tắc chỉ chạy khi có thao tác của người dùng; hành động của quy tắc không kích hoạt thêm quy tắc khác (tránh vòng lặp).</p>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {rule ? 'Lưu' : 'Tạo quy tắc'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
