import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateUser, useUpdateUser, type UserWithStats } from '../../hooks/useUsers';
import { getErrorMessage } from '../../lib/api';
import { ROLE_LABEL } from '../../lib/constants';
import { inputClass } from '../../lib/styles';
import type { Role, User } from '../../types/api';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

const ROLES: Role[] = ['member', 'leader', 'admin'];

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(120, 'Tối đa 120 ký tự'),
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  role: z.enum(['admin', 'leader', 'member']),
  isActive: z.boolean(),
  password: z.string(),
});
type FormValues = z.infer<typeof baseSchema>;

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = chế độ sửa */
  user?: User | UserWithStats;
  /** Không cho đổi vai trò/trạng thái chính mình */
  isSelf?: boolean;
}

export function UserFormModal({ open, onClose, user, isSelf = false }: UserFormModalProps) {
  const toast = useToast();
  const isEdit = user !== undefined;
  const create = useCreateUser();
  const update = useUpdateUser(user?.id ?? 0);
  const [serverError, setServerError] = useState<string | null>(null);

  // Mật khẩu: bắt buộc >= 8 ký tự khi tạo mới; khi sửa chỉ kiểm tra nếu có nhập
  const schema = baseSchema.superRefine((values, ctx) => {
    if ((!isEdit || values.password) && values.password.length < 8) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu phải có ít nhất 8 ký tự' });
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'member',
      isActive: user?.isActive ?? true,
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      if (isEdit) {
        await update.mutateAsync({
          name: values.name,
          ...(isSelf ? {} : { role: values.role, isActive: values.isActive }),
          ...(values.password ? { password: values.password } : {}),
        });
        toast.show('Đã cập nhật người dùng', 'success');
      } else {
        await create.mutateAsync({ name: values.name, email: values.email, password: values.password, role: values.role });
        toast.show('Đã tạo người dùng', 'success');
      }
      onClose();
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Sửa người dùng' : 'Thêm người dùng'}>
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
        <InlineError message={serverError} />
        <Field label="Họ tên" htmlFor="user-name" error={errors.name?.message}>
          <input id="user-name" className={inputClass} {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="user-email" error={errors.email?.message}>
          <input id="user-email" type="email" className={inputClass} disabled={isEdit} {...register('email')} />
        </Field>
        <Field label="Vai trò" htmlFor="user-role">
          <select id="user-role" className={inputClass} disabled={isSelf} {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={isSelf} className="h-4 w-4 rounded border-slate-300 text-brand-600" {...register('isActive')} />
            Tài khoản đang hoạt động
          </label>
        )}
        <Field
          label={isEdit ? 'Đặt lại mật khẩu (tùy chọn)' : 'Mật khẩu'}
          htmlFor="user-password"
          error={errors.password?.message}
          hint={isEdit ? 'Để trống nếu không đổi. Người dùng sẽ bị đăng xuất khỏi mọi thiết bị.' : 'Tối thiểu 8 ký tự'}
        >
          <input id="user-password" type="password" autoComplete="new-password" className={inputClass} {...register('password')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
