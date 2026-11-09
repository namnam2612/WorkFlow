import { ArrowLeft, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { RuleFormModal } from '../components/automation/RuleFormModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useAutomations, useDeleteAutomation, useUpdateAutomation } from '../hooks/useAutomations';
import { useProject } from '../hooks/useProjects';
import { statusesOf, useProjectStatuses } from '../hooks/useStatuses';
import { getErrorMessage } from '../lib/api';
import { PRIORITY_META, TRIGGER_LABEL, TYPE_LABEL } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import { canManageProject } from '../lib/permissions';
import type { AutomationAction, AutomationRule } from '../types/api';

export default function AutomationsPage() {
  const projectId = Number(useParams().id);
  const { user } = useAuth();
  const toast = useToast();
  const projectQuery = useProject(projectId);
  const query = useAutomations(projectId);
  const statuses = useProjectStatuses(projectId);
  const update = useUpdateAutomation();
  const remove = useDeleteAutomation();
  const [form, setForm] = useState<AutomationRule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AutomationRule | null>(null);

  if (projectQuery.isLoading || query.isLoading) return <PageLoader />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const project = projectQuery.data;
  const canManage = canManageProject(user, project);
  const all = [...statusesOf(statuses.data, 'task'), ...statusesOf(statuses.data, 'bug')];
  const statusName = (id: number) => all.find((s) => s.id === id)?.name ?? `#${id}`;
  const memberName = (id: number) => project.members.find((m) => m.id === id)?.name ?? `#${id}`;

  const describeAction = (a: AutomationAction): string => {
    switch (a.type) {
      case 'set_status':
        return `đổi sang "${statusName(a.statusId)}"`;
      case 'assign':
        return `giao cho ${a.userIds.map(memberName).join(', ')}`;
      case 'set_priority':
        return `đặt ưu tiên ${PRIORITY_META[a.priority].label}`;
      case 'add_comment':
        return `bình luận "${a.text}"`;
      case 'notify':
        return `thông báo${a.toLeader ? ' trưởng nhóm' : ''}${a.userIds?.length ? ` ${a.userIds.map(memberName).join(', ')}` : ''}: "${a.message}"`;
    }
  };
  const describeConditions = (r: AutomationRule): string => {
    const parts = [r.conditions.statusId ? `trạng thái "${statusName(r.conditions.statusId)}"` : null, r.conditions.type ? `loại ${TYPE_LABEL[r.conditions.type]}` : null, r.conditions.priority ? `ưu tiên ${PRIORITY_META[r.conditions.priority].label}` : null].filter(Boolean);
    return parts.length > 0 ? `nếu ${parts.join(', ')}` : 'mọi công việc';
  };

  return (
    <>
      <Link to={`/projects/${project.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project.name}
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Tự động hóa</h1>
          <p className="text-sm text-slate-500">Quy tắc tự đổi trạng thái, giao việc, bình luận hoặc thông báo khi có sự kiện trên công việc</p>
        </div>
        {canManage && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm('new')}>
            Tạo quy tắc
          </Button>
        )}
      </div>

      {query.data.length === 0 ? (
        <EmptyState title="Chưa có quy tắc nào" description="Ví dụ: khi Bug khẩn cấp được tạo thì báo ngay cho trưởng nhóm; khi việc chuyển sang Hoàn thành thì thêm bình luận." action={canManage ? <Button onClick={() => setForm('new')}>Tạo quy tắc</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {query.data.map((r) => (
            <Card key={r.id} title="">
              <div className="flex flex-wrap items-start gap-3">
                <Zap className={r.enabled ? 'mt-0.5 h-5 w-5 text-amber-400' : 'mt-0.5 h-5 w-5 text-slate-500'} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {TRIGGER_LABEL[r.trigger]}, {describeConditions(r)} → {r.actions.map(describeAction).join('; ')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Đã chạy {r.runCount} lần{r.lastRunAt ? `, gần nhất ${formatDateTime(r.lastRunAt)}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={(e) => void update.mutateAsync({ id: r.id, enabled: e.target.checked }).catch((err: unknown) => toast.show(getErrorMessage(err), 'error'))}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Bật quy tắc ${r.name}`}
                      />
                      Bật
                    </label>
                    <button type="button" aria-label={`Sửa ${r.name}`} onClick={() => setForm(r)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label={`Xóa ${r.name}`} onClick={() => setDeleting(r)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {form !== null && <RuleFormModal project={project} rule={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title="Xóa quy tắc"
        message={`Xóa quy tắc "${deleting?.name ?? ''}"? Các thay đổi nó đã thực hiện trước đây vẫn giữ nguyên.`}
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          void remove
            .mutateAsync(deleting.id)
            .then(() => toast.show('Đã xóa quy tắc', 'success'))
            .catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))
            .finally(() => setDeleting(null));
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
