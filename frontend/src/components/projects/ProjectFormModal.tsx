import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useFormAttachments } from '../../hooks/useFormAttachments';
import { useSaveProject } from '../../hooks/useProjects';
import { useUsers } from '../../hooks/useUsers';
import { getErrorMessage } from '../../lib/api';
import { isoToVnDateInput, vnDateInputToIso } from '../../lib/format';
import { inputClass } from '../../lib/styles';
import type { ProjectDetail, ProjectSummary } from '../../types/api';
import { AttachmentPicker } from '../attachments/AttachmentPicker';
import { FormUploadPhase } from '../attachments/FormUploadPhase';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập tên dự án').max(160, 'Tối đa 160 ký tự'),
    description: z.string().max(5000, 'Tối đa 5000 ký tự'),
    startDate: z.string(),
    endDate: z.string(),
    slackWebhookUrl: z.string().trim().refine((v) => v === '' || /^https:\/\/hooks\.slack\.com\/(services|workflows|triggers)\//.test(v), 'Phải có dạng https://hooks.slack.com/services/...'),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu',
  });
type FormValues = z.infer<typeof schema>;

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = chế độ sửa */
  project?: ProjectSummary | ProjectDetail;
  onSaved?: (project: ProjectDetail) => void;
}

export function ProjectFormModal({ open, onClose, project, onSaved }: ProjectFormModalProps) {
  const toast = useToast();
  const save = useSaveProject(project?.id);
  const usersQuery = useUsers({ isActive: true }, open && !project);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const attach = useFormAttachments('project');
  const savedRef = useRef<ProjectDetail | null>(null);
  const busy = save.isPending || attach.uploading;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      startDate: isoToVnDateInput(project?.startDate),
      endDate: isoToVnDateInput(project?.endDate),
      slackWebhookUrl: '',
    },
  });
  const [removeSlack, setRemoveSlack] = useState(false);

  const toggleMember = (id: number) =>
    setMemberIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const finish = (saved: ProjectDetail) => {
    toast.show(project ? 'Đã cập nhật dự án' : 'Đã tạo dự án', 'success');
    onSaved?.(saved);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    let saved: ProjectDetail;
    try {
      saved = await save.mutateAsync({
        name: values.name,
        description: values.description.trim() || null,
        startDate: vnDateInputToIso(values.startDate),
        endDate: vnDateInputToIso(values.endDate),
        // Webhook là bí mật nên không điền sẵn: để trống = giữ nguyên, nhập mới = thay, "Gỡ" = xóa
        ...(values.slackWebhookUrl ? { slackWebhookUrl: values.slackWebhookUrl } : removeSlack ? { slackWebhookUrl: null } : {}),
        ...(project ? {} : { memberIds }),
      });
    } catch (error) {
      setServerError(getErrorMessage(error));
      return;
    }
    // Dự án đã lưu; file lỗi không làm mất dự án (xem FormUploadPhase để thử lại)
    attach.setSavedId(saved.id);
    savedRef.current = saved;
    if (await attach.uploadFor(saved.id)) finish(saved);
  };

  const retryUpload = async () => {
    if (attach.savedId === null || !savedRef.current) return;
    if (await attach.uploadFor(attach.savedId)) finish(savedRef.current);
  };

  const candidates = (usersQuery.data?.items ?? []).filter((u) => u.role !== 'admin');

  return (
    <Modal open={open} onClose={attach.uploading ? () => undefined : onClose} title={project ? 'Sửa dự án' : 'Tạo dự án mới'} size="lg">
      {attach.uploading || attach.hasFailures ? (
        <FormUploadPhase
          noun="dự án"
          entries={attach.entries}
          uploading={attach.uploading}
          onRetry={() => void retryUpload()}
          onSkip={() => {
            if (savedRef.current) finish(savedRef.current);
          }}
        />
      ) : (
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
        <InlineError message={serverError} />
        <Field label="Tên dự án" htmlFor="project-name" error={errors.name?.message}>
          <input id="project-name" className={inputClass} {...register('name')} />
        </Field>
        <Field label="Mô tả" htmlFor="project-description" error={errors.description?.message}>
          <textarea id="project-description" rows={3} className={inputClass} {...register('description')} />
        </Field>
        <AttachmentPicker files={attach.files} onChange={attach.setFiles} disabled={busy} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ngày bắt đầu" htmlFor="project-start" error={errors.startDate?.message}>
            <input id="project-start" type="date" className={inputClass} {...register('startDate')} />
          </Field>
          <Field label="Ngày kết thúc" htmlFor="project-end" error={errors.endDate?.message}>
            <input id="project-end" type="date" className={inputClass} {...register('endDate')} />
          </Field>
        </div>

        <Field
          label="Slack webhook (tùy chọn)"
          htmlFor="project-slack"
          error={errors.slackWebhookUrl?.message}
          hint={
            project?.slackConfigured && !removeSlack
              ? 'Đã cấu hình. Nhập URL mới để thay, hoặc bấm "Gỡ webhook". Sự kiện của dự án sẽ được đăng vào kênh Slack.'
              : 'Dán Incoming Webhook của Slack để đăng sự kiện của dự án (giao việc, đổi trạng thái, đến hạn...) vào kênh.'
          }
        >
          <div className="flex gap-2">
            <input id="project-slack" type="password" autoComplete="off" placeholder={project?.slackConfigured && !removeSlack ? '••••••••••••••••' : 'https://hooks.slack.com/services/...'} className={inputClass} {...register('slackWebhookUrl')} />
            {project?.slackConfigured && (
              <Button variant="secondary" onClick={() => setRemoveSlack((v) => !v)}>
                {removeSlack ? 'Giữ lại' : 'Gỡ webhook'}
              </Button>
            )}
          </div>
        </Field>

        {!project && (
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Thành viên</p>
            <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {usersQuery.isLoading && <p className="p-3 text-sm text-slate-500">Đang tải danh sách...</p>}
              {candidates.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                  <Avatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                  <span className="text-sm text-slate-800">{u.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{u.email}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Bạn có thể thêm/bớt thành viên sau trong trang chi tiết dự án.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={busy}>
            {project ? 'Lưu thay đổi' : 'Tạo dự án'}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
