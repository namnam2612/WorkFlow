import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { DeadlineText } from '../components/tasks/DeadlineText';
import { SubtaskRow } from '../components/tasks/SubtaskRow';
import { TaskDiscussion } from '../components/tasks/TaskDiscussion';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { Avatar } from '../components/ui/Avatar';
import { PriorityBadge, StatusBadge } from '../components/ui/Badges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useDeleteTask, useTask, useUpdateTask } from '../hooks/useTasks';
import { getErrorMessage } from '../lib/api';
import { STATUSES, STATUS_META } from '../lib/constants';
import { formatDateTime, isOverdue } from '../lib/format';
import { canManageProject, isAssignee } from '../lib/permissions';
import { inputClass } from '../lib/styles';
import type { TaskStatus } from '../types/api';

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-900">{children}</dd>
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const taskQuery = useTask(taskId);
  const task = taskQuery.data;
  const update = useUpdateTask(taskId);
  const deleteTask = useDeleteTask();

  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);

  if (taskQuery.isLoading) return <PageLoader />;
  if (taskQuery.isError || !task) return <ErrorState error={taskQuery.error} onRetry={() => void taskQuery.refetch()} />;

  const canManage = canManageProject(user, task.project);
  const canUpdateProgress = canManage || isAssignee(user, task);
  const isSubtask = task.parentId !== null;

  const changeStatus = async (status: TaskStatus) => {
    try {
      await update.mutateAsync({ status });
      toast.show('Đã cập nhật trạng thái', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  const saveHours = async () => {
    if (hoursDraft === null) return;
    const value = hoursDraft.trim() === '' ? null : Number(hoursDraft);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 10000)) {
      toast.show('Giờ làm phải là số từ 0 đến 10000', 'error');
      return;
    }
    try {
      await update.mutateAsync({ actualHours: value });
      setHoursDraft(null);
      toast.show('Đã cập nhật giờ làm', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(task.id);
      toast.show('Đã xóa công việc', 'success');
      navigate(task.parent ? `/tasks/${task.parent.id}` : `/projects/${task.projectId}`, { replace: true });
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Link
          to={task.parent ? `/tasks/${task.parent.id}` : `/projects/${task.projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {task.parent ? `Công việc cha: ${task.parent.title}` : task.project.name}
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {isOverdue(task) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Quá hạn</span>}
          </div>
          <h1 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">{task.title}</h1>
        </div>
        {canManage && (
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
        <div className="space-y-6 lg:col-span-2">
          <Card title="Mô tả">
            <p className="whitespace-pre-line break-words text-sm text-slate-700">{task.description || 'Chưa có mô tả.'}</p>
          </Card>

          {!isSubtask && (
            <Card
              title={`Công việc con (${task.subtaskDone}/${task.subtaskTotal})`}
              action={
                canManage && (
                  <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddingSubtask(true)}>
                    Thêm
                  </Button>
                )
              }
            >
              {task.subtasks.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có công việc con.</p>
              ) : (
                <>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((task.subtaskDone / task.subtaskTotal) * 100)}%` }} />
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {task.subtasks.map((sub) => (
                      <SubtaskRow key={sub.id} subtask={sub} canToggle={canManage || isAssignee(user, sub)} />
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          <TaskDiscussion taskId={task.id} />
        </div>

        <div className="space-y-6">
          <Card title="Thông tin">
            <dl className="-my-2.5 divide-y divide-slate-100">
              <MetaRow label="Dự án">
                <Link to={`/projects/${task.project.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                  {task.project.name}
                </Link>
              </MetaRow>
              <MetaRow label="Người thực hiện">
                {task.assignee ? (
                  <Link to={`/members/${task.assignee.id}`} className="inline-flex items-center gap-2 hover:text-brand-700">
                    <Avatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="xs" />
                    {task.assignee.name}
                  </Link>
                ) : (
                  <span className="text-slate-400">Chưa giao</span>
                )}
              </MetaRow>
              <MetaRow label="Người tạo">{task.creator.name}</MetaRow>
              <MetaRow label="Trạng thái">
                {canUpdateProgress ? (
                  <select aria-label="Trạng thái" value={task.status} disabled={update.isPending} onChange={(e) => void changeStatus(e.target.value as TaskStatus)} className={`${inputClass} w-auto py-1`}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={task.status} />
                )}
              </MetaRow>
              <MetaRow label="Ưu tiên">
                <PriorityBadge priority={task.priority} />
              </MetaRow>
              <MetaRow label="Deadline">
                <div className="flex flex-col items-end gap-0.5">
                  <span>{formatDateTime(task.deadline)}</span>
                  {task.deadline && <DeadlineText task={task} />}
                </div>
              </MetaRow>
              <MetaRow label="Giờ ước tính">{task.estimatedHours ?? '—'}</MetaRow>
              <MetaRow label="Giờ thực tế">
                {canUpdateProgress ? (
                  <div className="flex items-center justify-end gap-2">
                    <input
                      aria-label="Giờ thực tế"
                      inputMode="decimal"
                      value={hoursDraft ?? String(task.actualHours ?? '')}
                      onChange={(e) => setHoursDraft(e.target.value)}
                      className={`${inputClass} w-20 py-1 text-right`}
                    />
                    {hoursDraft !== null && (
                      <Button size="sm" loading={update.isPending} onClick={() => void saveHours()}>
                        Lưu
                      </Button>
                    )}
                  </div>
                ) : (
                  (task.actualHours ?? '—')
                )}
              </MetaRow>
              <MetaRow label="Tạo lúc">{formatDateTime(task.createdAt)}</MetaRow>
              <MetaRow label="Hoàn thành lúc">{formatDateTime(task.completedAt)}</MetaRow>
            </dl>
          </Card>
        </div>
      </div>

      {editing && <TaskFormModal open task={task} onClose={() => setEditing(false)} />}
      {addingSubtask && <TaskFormModal open parentId={task.id} defaultProjectId={task.projectId} onClose={() => setAddingSubtask(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa công việc"
        message={`Xóa "${task.title}"${task.subtasks.length > 0 ? ' cùng các công việc con' : ''}, bình luận và lịch sử? Thao tác này không thể hoàn tác.`}
        loading={deleteTask.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
