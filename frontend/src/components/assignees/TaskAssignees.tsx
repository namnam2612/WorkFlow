import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../../hooks/useProjects';
import { useUpdateTask } from '../../hooks/useTasks';
import { getErrorMessage } from '../../lib/api';
import type { TaskDetail, UserBrief } from '../../types/api';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useToast } from '../ui/useToast';
import { AssigneePicker } from './AssigneePicker';

interface TaskAssigneesProps {
  task: TaskDetail;
  /** Người xem là leader/admin của dự án: thêm/bớt bất kỳ ai */
  canManage: boolean;
  /** Người xem là thành viên tạo công việc con này: chỉ thêm/bớt được CHÍNH MÌNH */
  canEditSelf: boolean;
  currentUser: UserBrief | null;
}

/** Danh sách người được giao trong chi tiết task; người có quyền thêm/bớt trực tiếp (lưu ngay mỗi lần chọn) */
export function TaskAssignees({ task, canManage, canEditSelf, currentUser }: TaskAssigneesProps) {
  const toast = useToast();
  const update = useUpdateTask(task.id);
  const [editing, setEditing] = useState(false);
  // Hiện ngay lựa chọn mới trong lúc chờ server (trả về null khi xong hoặc khi lỗi để quay về dữ liệu thật)
  const [optimistic, setOptimistic] = useState<UserBrief[] | null>(null);
  const current = optimistic ?? task.assignees;
  const canEdit = canManage || (canEditSelf && currentUser !== null);
  const projectQuery = useProject(editing ? task.projectId : undefined);

  const members = projectQuery.data?.members ?? [];
  const options: UserBrief[] = canManage ? members : members.filter((m) => m.id === currentUser?.id);
  // Thành viên chỉ động được vào chính mình: người khác trong danh sách bị khóa
  const lockedIds = canManage ? [] : current.filter((a) => a.id !== currentUser?.id).map((a) => a.id);

  const change = async (users: UserBrief[]) => {
    setOptimistic(users);
    try {
      await update.mutateAsync({ assigneeIds: users.map((u) => u.id) });
      toast.show('Đã cập nhật người thực hiện', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    } finally {
      setOptimistic(null);
    }
  };

  return (
    <div className="py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-slate-500">Người thực hiện{current.length > 1 ? ` (${current.length})` : ''}</dt>
        {canEdit && (
          <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? 'Xong' : 'Thêm/bớt'}
          </Button>
        )}
      </div>
      <dd className="mt-2">
        {editing ? (
          <AssigneePicker options={options} selected={current} onChange={(users) => void change(users)} lockedIds={lockedIds} disabled={update.isPending} />
        ) : current.length === 0 ? (
          <span className="text-slate-400">Chưa giao</span>
        ) : (
          <ul className="space-y-1.5" aria-label="Người thực hiện">
            {current.map((user) => (
              <li key={user.id}>
                <Link to={`/members/${user.id}`} className="inline-flex items-center gap-2 text-slate-900 hover:text-brand-700">
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} size="xs" />
                  {user.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}
