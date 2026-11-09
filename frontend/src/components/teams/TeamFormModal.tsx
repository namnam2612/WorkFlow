import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useCreateTeam, useUpdateTeam } from '../../hooks/useTeams';
import { useUsers } from '../../hooks/useUsers';
import { getErrorMessage } from '../../lib/api';
import { inputClass } from '../../lib/styles';
import type { Team } from '../../types/api';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Tạo/sửa nhóm. Chỉ admin chọn được trưởng nhóm; leader tạo nhóm thì tự làm trưởng nhóm. */
export function TeamFormModal({ team, onClose }: { team?: Team; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateTeam();
  const update = useUpdateTeam(team?.id ?? 0);
  const isAdmin = user?.role === 'admin';
  const usersQuery = useUsers({ isActive: true }, isAdmin);
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [leaderId, setLeaderId] = useState(String(team?.leaderId ?? ''));
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim() === '') return setError('Vui lòng nhập tên nhóm');
    const input = { name: name.trim(), description: description.trim() || null, ...(isAdmin && leaderId ? { leaderId: Number(leaderId) } : {}) };
    try {
      if (team) await update.mutateAsync(input);
      else await create.mutateAsync(input);
      toast.show(team ? 'Đã cập nhật nhóm' : 'Đã tạo nhóm', 'success');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const leaders = (usersQuery.data?.items ?? []).filter((u) => u.role !== 'member');
  return (
    <Modal open onClose={onClose} title={team ? 'Sửa nhóm' : 'Tạo nhóm'}>
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <InlineError message={error} />
        <Field label="Tên nhóm" htmlFor="team-name">
          <input id="team-name" autoFocus className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mô tả" htmlFor="team-desc">
          <textarea id="team-desc" rows={3} className={inputClass} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {isAdmin && (
          <Field label="Trưởng nhóm" htmlFor="team-leader" hint="Để trống: chính bạn là trưởng nhóm (khi tạo mới).">
            <select id="team-leader" className={inputClass} value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
              <option value="">{team ? '— Giữ nguyên —' : '— Chính tôi —'}</option>
              {leaders.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {team ? 'Lưu' : 'Tạo nhóm'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
