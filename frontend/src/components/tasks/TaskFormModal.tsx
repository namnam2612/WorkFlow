import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../auth/useAuth';
import { useFormAttachments } from '../../hooks/useFormAttachments';
import { useProject, useProjects } from '../../hooks/useProjects';
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks';
import { getErrorMessage } from '../../lib/api';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../../lib/constants';
import { isoToVnDateTimeInput, vnDateTimeInputToIso } from '../../lib/format';
import { canManageProject } from '../../lib/permissions';
import { inputClass, labelClass } from '../../lib/styles';
import type { Priority, Task, TaskStatus, UserBrief } from '../../types/api';
import { AssigneePicker } from '../assignees/AssigneePicker';
import { AttachmentPicker } from '../attachments/AttachmentPicker';
import { FormUploadPhase } from '../attachments/FormUploadPhase';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

const hoursField = z
  .string()
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 10000), 'Giờ phải là số từ 0 đến 10000');

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(255, 'Tối đa 255 ký tự'),
  description: z.string().max(10000, 'Tối đa 10000 ký tự'),
  projectId: z.string().min(1, 'Vui lòng chọn dự án'),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  deadline: z.string(),
  estimatedHours: hoursField,
  actualHours: hoursField,
});
type FormValues = z.infer<typeof schema>;

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = chế độ sửa */
  task?: Task;
  defaultProjectId?: number;
  defaultStatus?: TaskStatus;
  /** Tạo công việc con */
  parentId?: number;
  onSaved?: (taskId: number) => void;
}

const toNumberOrNull = (value: string): number | null => (value === '' ? null : Number(value));

export function TaskFormModal({ open, onClose, task, defaultProjectId, defaultStatus, parentId, onSaved }: TaskFormModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateTask();
  const update = useUpdateTask(task?.id ?? 0);
  const projectsQuery = useProjects();
  const [serverError, setServerError] = useState<string | null>(null);
  // Nhiều người cùng thực hiện; giữ ngoài react-hook-form vì là danh sách đối tượng
  const [assignees, setAssignees] = useState<UserBrief[]>(task?.assignees ?? []);
  const attach = useFormAttachments('task');
  const savedTaskId = useRef<number | null>(null);
  const busy = create.isPending || update.isPending || attach.uploading;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      projectId: String(task?.projectId ?? defaultProjectId ?? ''),
      status: task?.status ?? defaultStatus ?? 'todo',
      priority: task?.priority ?? 'medium',
      deadline: isoToVnDateTimeInput(task?.deadline),
      estimatedHours: task?.estimatedHours != null ? String(task.estimatedHours) : '',
      actualHours: task?.actualHours != null ? String(task.actualHours) : '',
    },
  });

  const projectId = Number(watch('projectId')) || undefined;
  const projectQuery = useProject(projectId);
  const manageableProjects = (projectsQuery.data ?? []).filter((p) => canManageProject(user, p));
  // Thành viên (không phải leader/admin của dự án) chỉ được giao việc con cho chính mình
  const canAssignOthers = canManageProject(user, projectQuery.data);
  const members: UserBrief[] = (projectQuery.data?.members ?? []).filter((m) => canAssignOthers || m.id === user?.id);
  // Người khác đã được giao từ trước không bị thành viên gỡ ra (backend cũng chặn)
  const lockedIds = canAssignOthers ? [] : assignees.filter((a) => a.id !== user?.id).map((a) => a.id);
  const isEdit = task !== undefined;
  const isSubtask = parentId !== undefined || task?.parentId != null;

  const finish = (taskId: number) => {
    toast.show(isEdit ? 'Đã cập nhật công việc' : isSubtask ? 'Đã thêm công việc con' : 'Đã tạo công việc', 'success');
    onSaved?.(taskId);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const payload = {
      title: values.title,
      description: values.description.trim() || null,
      assigneeIds: assignees.map((a) => a.id),
      status: values.status,
      priority: values.priority,
      deadline: vnDateTimeInputToIso(values.deadline),
      estimatedHours: toNumberOrNull(values.estimatedHours),
      actualHours: toNumberOrNull(values.actualHours),
    };
    let taskId: number;
    try {
      if (isEdit && task) {
        await update.mutateAsync(payload);
        taskId = task.id;
      } else {
        taskId = (await create.mutateAsync({ ...payload, projectId: Number(values.projectId), parentId })).id;
      }
    } catch (error) {
      setServerError(getErrorMessage(error));
      return;
    }
    // Công việc đã lưu; file lỗi không làm mất nó (xem FormUploadPhase để thử lại)
    savedTaskId.current = taskId;
    attach.setSavedId(taskId);
    if (await attach.uploadFor(taskId)) finish(taskId);
  };

  const retryUpload = async () => {
    if (savedTaskId.current === null) return;
    if (await attach.uploadFor(savedTaskId.current)) finish(savedTaskId.current);
  };

  const title = isEdit ? 'Sửa công việc' : isSubtask ? 'Thêm công việc con' : 'Tạo công việc mới';

  return (
    <Modal open={open} onClose={attach.uploading ? () => undefined : onClose} title={title} size="lg">
      {attach.uploading || attach.hasFailures ? (
        <FormUploadPhase
          noun="công việc"
          entries={attach.entries}
          uploading={attach.uploading}
          onRetry={() => void retryUpload()}
          onSkip={() => {
            if (savedTaskId.current !== null) finish(savedTaskId.current);
          }}
        />
      ) : (
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
        <InlineError message={serverError} />
        <Field label="Tiêu đề" htmlFor="task-title" error={errors.title?.message}>
          <input id="task-title" autoFocus className={inputClass} {...register('title')} />
        </Field>
        <Field label="Mô tả" htmlFor="task-description" error={errors.description?.message}>
          <textarea id="task-description" rows={4} className={inputClass} {...register('description')} />
        </Field>
        <AttachmentPicker files={attach.files} onChange={attach.setFiles} disabled={busy} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dự án" htmlFor="task-project" error={errors.projectId?.message}>
            <select
              id="task-project"
              className={inputClass}
              disabled={isEdit || parentId !== undefined || defaultProjectId !== undefined}
              {...register('projectId', { onChange: () => setAssignees([]) })}
            >
              <option value="">— Chọn dự án —</option>
              {(isEdit || parentId !== undefined || defaultProjectId !== undefined ? (projectsQuery.data ?? []) : manageableProjects).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái" htmlFor="task-status">
            <select id="task-status" className={inputClass} {...register('status')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <p className={labelClass}>Người thực hiện{assignees.length > 1 ? ` (${assignees.length})` : ''}</p>
            <AssigneePicker options={members} selected={assignees} onChange={setAssignees} lockedIds={lockedIds} disabled={!projectId || busy} emptyLabel={projectId ? 'Chưa giao cho ai' : 'Chọn dự án trước'} />
            <p className="mt-1 text-xs text-slate-500">{!canAssignOthers && projectId ? 'Bạn chỉ có thể giao công việc con cho chính mình' : 'Có thể giao cho nhiều người cùng làm.'}</p>
          </div>
          <Field label="Mức ưu tiên" htmlFor="task-priority">
            <select id="task-priority" className={inputClass} {...register('priority')}>
              {PRIORITIES.map((p: Priority) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deadline (giờ Việt Nam)" htmlFor="task-deadline" error={errors.deadline?.message}>
            <input id="task-deadline" type="datetime-local" className={inputClass} {...register('deadline')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giờ ước tính" htmlFor="task-est" error={errors.estimatedHours?.message}>
              <input id="task-est" inputMode="decimal" className={inputClass} {...register('estimatedHours')} />
            </Field>
            <Field label="Giờ thực tế" htmlFor="task-actual" error={errors.actualHours?.message}>
              <input id="task-actual" inputMode="decimal" className={inputClass} {...register('actualHours')} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={busy}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo'}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
