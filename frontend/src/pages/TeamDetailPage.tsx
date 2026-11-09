import { ArrowLeft, Pencil, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TeamFormModal } from '../components/teams/TeamFormModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useAddTeamMember, useDeleteTeam, useRemoveTeamMember, useTeam, useUpdateTeamMember } from '../hooks/useTeams';
import { useUsers } from '../hooks/useUsers';
import { getErrorMessage } from '../lib/api';
import { SPECIALTIES, SPECIALTY_LABEL } from '../lib/constants';
import { inputClass } from '../lib/styles';
import type { Specialty } from '../types/api';

export default function TeamDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const toast = useToast();
  const query = useTeam(id);
  const team = query.data;
  const usersQuery = useUsers({ isActive: true }, team?.canManage ?? false);
  const addMember = useAddTeamMember(id);
  const updateMember = useUpdateTeamMember(id);
  const removeMember = useRemoveTeamMember(id);
  const deleteTeam = useDeleteTeam();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selected, setSelected] = useState('');
  const [specialty, setSpecialty] = useState<Specialty>('dev');

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !team) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const inTeam = new Set(team.members.map((m) => m.id));
  const addable = (usersQuery.data?.items ?? []).filter((u) => !inTeam.has(u.id) && u.role !== 'admin');
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.show(ok, 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  return (
    <>
      <Link to="/teams" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Nhóm
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">{team.name}</h1>
          {team.description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{team.description}</p>}
          <p className="mt-2 text-xs text-slate-500">
            Trưởng nhóm: <span className="font-medium text-slate-800">{team.leader.name}</span>
          </p>
        </div>
        {team.canManage && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Sửa
            </Button>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
              Xóa
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Thành viên (${team.members.length})`}>
            <ul className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/members/${m.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                      {m.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{m.jobTitle || m.email}</p>
                  </div>
                  {team.canManage ? (
                    <select
                      aria-label={`Chuyên môn của ${m.name}`}
                      value={m.specialty}
                      onChange={(e) => void run(() => updateMember.mutateAsync({ userId: m.id, specialty: e.target.value as Specialty }))}
                      className={`${inputClass} w-auto! py-1 text-xs`}
                    >
                      {SPECIALTIES.map((s) => (
                        <option key={s} value={s}>
                          {SPECIALTY_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full border border-white/[0.14] px-2 py-0.5 text-xs text-slate-600">{SPECIALTY_LABEL[m.specialty]}</span>
                  )}
                  {team.canManage && m.id !== team.leaderId && (
                    <button type="button" aria-label={`Gỡ ${m.name} khỏi nhóm`} onClick={() => void run(() => removeMember.mutateAsync(m.id), 'Đã gỡ khỏi nhóm')} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {team.canManage && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
                <select aria-label="Chọn người để thêm" value={selected} onChange={(e) => setSelected(e.target.value)} className={`${inputClass} min-w-48 flex-1`}>
                  <option value="">— Chọn thành viên —</option>
                  {addable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <select aria-label="Chuyên môn" value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)} className={`${inputClass} w-auto!`}>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>
                      {SPECIALTY_LABEL[s]}
                    </option>
                  ))}
                </select>
                <Button
                  icon={<UserPlus className="h-4 w-4" />}
                  disabled={!selected}
                  loading={addMember.isPending}
                  onClick={() => void run(() => addMember.mutateAsync({ userId: Number(selected), specialty }), 'Đã thêm vào nhóm').then(() => setSelected(''))}
                >
                  Thêm
                </Button>
              </div>
            )}
            {team.canManage && <p className="mt-2 text-xs text-slate-500">Thành viên mới cũng được thêm vào mọi dự án của nhóm. Gỡ khỏi nhóm không gỡ khỏi dự án.</p>}
          </Card>
        </div>
        <Card title={`Dự án (${team.projects.length})`}>
          {team.projects.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dự án nào. Chọn nhóm này khi tạo hoặc sửa dự án.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {team.projects.map((p) => (
                <li key={p.id} className="py-2.5">
                  <Link to={`/projects/${p.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editing && <TeamFormModal team={team} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa nhóm"
        message={`Xóa nhóm "${team.name}"? Các dự án của nhóm vẫn giữ nguyên, chỉ bỏ liên kết với nhóm.`}
        loading={deleteTeam.isPending}
        onConfirm={() => void run(() => deleteTeam.mutateAsync(id), 'Đã xóa nhóm').then(() => navigate('/teams', { replace: true }))}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
