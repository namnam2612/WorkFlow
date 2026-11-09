import { BarChart3, GanttChart, KanbanSquare, ListChecks, ListTodo, Pencil, Plus, Send, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AttachmentSection } from '../components/attachments/AttachmentSection';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { TaskTable } from '../components/tasks/TaskTable';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useDeleteProject, useProject, useProjectMembers } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useUsers';
import { api, getErrorMessage } from '../lib/api';
import { ROLE_LABEL } from '../lib/constants';
import { formatDate } from '../lib/format';
import { canManageProject } from '../lib/permissions';
import { inputClass } from '../lib/styles';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const projectQuery = useProject(projectId);
  const project = projectQuery.data;
  const canManage = canManageProject(user, project);
  const tasksQuery = useTasks({ projectId, pageSize: 8, sortBy: 'updatedAt', order: 'desc' }, !Number.isNaN(projectId));
  const usersQuery = useUsers({ isActive: true }, canManage);
  const { add, remove } = useProjectMembers(projectId);
  const deleteProject = useDeleteProject();

  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [testingSlack, setTestingSlack] = useState(false);

  const testSlack = async () => {
    setTestingSlack(true);
    try {
      const result = await api.post<{ ok: boolean }>(`/projects/${projectId}/slack-test`);
      toast.show(result.ok ? 'Đã gửi tin thử tới Slack' : 'Slack không nhận tin: kiểm tra lại webhook', result.ok ? 'success' : 'error');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    } finally {
      setTestingSlack(false);
    }
  };

  if (projectQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !project) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;

  const memberIds = new Set(project.members.map((m) => m.id));
  const addable = (usersQuery.data?.items ?? []).filter((u) => !memberIds.has(u.id) && u.role !== 'admin');

  const handleAdd = async () => {
    if (!selectedUser) return;
    try {
      await add.mutateAsync(Number(selectedUser));
      setSelectedUser('');
      toast.show('Đã thêm thành viên', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await remove.mutateAsync(removeTarget.id);
      toast.show('Đã xóa thành viên khỏi dự án', 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    } finally {
      setRemoveTarget(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(project.id);
      toast.show('Đã xóa dự án', 'success');
      navigate('/projects', { replace: true });
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${formatDate(project.startDate)} → ${formatDate(project.endDate)} · Tạo bởi ${project.createdBy.name}${project.team ? ` · Nhóm ${project.team.name}` : ''}`}
        actions={
          <>
            <Button icon={<KanbanSquare className="h-4 w-4" />} onClick={() => navigate(`/projects/${project.id}/board`)}>
              Bảng Kanban
            </Button>
            <Button variant="secondary" icon={<ListTodo className="h-4 w-4" />} onClick={() => navigate(`/projects/${project.id}/backlog`)}>
              Backlog
            </Button>
            <Button variant="secondary" icon={<GanttChart className="h-4 w-4" />} onClick={() => navigate(`/projects/${project.id}/gantt`)}>
              Gantt
            </Button>
            <Button variant="secondary" icon={<BarChart3 className="h-4 w-4" />} onClick={() => navigate(`/projects/${project.id}/reports`)}>
              Báo cáo
            </Button>
            {canManage && (
              <>
                <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreatingTask(true)}>
                  Thêm công việc
                </Button>
                {project.slackConfigured && (
                  <Button variant="ghost" icon={<Send className="h-4 w-4" />} loading={testingSlack} onClick={() => void testSlack()}>
                    Gửi thử Slack
                  </Button>
                )}
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                  Sửa
                </Button>
                <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                  Xóa
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Tiến độ">
            <p className="mb-4 whitespace-pre-line text-sm text-slate-600">{project.description || 'Chưa có mô tả cho dự án này.'}</p>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-500">
                {project.doneCount}/{project.taskCount} công việc hoàn thành
              </span>
              <span className="font-semibold text-slate-800">{project.progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${project.progress}%` }} />
            </div>
            {project.overdueCount > 0 && <p className="mt-3 text-sm font-medium text-red-600">{project.overdueCount} công việc đang quá hạn</p>}
          </Card>

          <AttachmentSection scope={{ kind: 'project', id: project.id }} canUpload={canManage} title="File đính kèm của dự án" />

          <Card
            title="Công việc gần đây"
            action={
              <Link to={`/tasks?projectId=${project.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                <ListChecks className="h-4 w-4" /> Xem tất cả
              </Link>
            }
          >
            {tasksQuery.isLoading ? (
              <PageLoader />
            ) : tasksQuery.data && tasksQuery.data.items.length > 0 ? (
              <div className="-m-5">
                <TaskTable tasks={tasksQuery.data.items} showProject={false} />
              </div>
            ) : (
              <EmptyState title="Chưa có công việc" description={canManage ? 'Nhấn "Thêm công việc" để bắt đầu.' : undefined} />
            )}
          </Card>
        </div>

        <Card title={`Thành viên (${project.members.length})`}>
          {canManage && (
            <div className="mb-4 flex gap-2">
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className={inputClass} aria-label="Chọn người dùng để thêm">
                <option value="">— Thêm thành viên —</option>
                {addable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({ROLE_LABEL[u.role]})
                  </option>
                ))}
              </select>
              <Button icon={<UserPlus className="h-4 w-4" />} disabled={!selectedUser} loading={add.isPending} onClick={() => void handleAdd()}>
                Thêm
              </Button>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {project.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.name} avatarUrl={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <Link to={`/members/${m.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                    {m.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {ROLE_LABEL[m.role]}
                    {m.id === project.createdById && ' · Người tạo'}
                  </p>
                </div>
                {canManage && m.id !== project.createdById && (
                  <button type="button" aria-label={`Xóa ${m.name} khỏi dự án`} onClick={() => setRemoveTarget({ id: m.id, name: m.name })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {editing && <ProjectFormModal open project={project} onClose={() => setEditing(false)} />}
      {creatingTask && <TaskFormModal open defaultProjectId={project.id} onClose={() => setCreatingTask(false)} onSaved={(taskId) => navigate(`/tasks/${taskId}`)} />}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa dự án"
        message={`Xóa dự án "${project.name}" sẽ xóa toàn bộ công việc, bình luận và lịch sử trong dự án. Thao tác này không thể hoàn tác.`}
        loading={deleteProject.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={removeTarget !== null}
        title="Xóa thành viên"
        message={`Xóa ${removeTarget?.name ?? ''} khỏi dự án? Các công việc đang giao cho người này sẽ được bỏ giao.`}
        confirmLabel="Xóa khỏi dự án"
        loading={remove.isPending}
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  );
}
