import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { AvatarEditor } from '../components/profile/AvatarEditor';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { InlineError } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useUpdateUser } from '../hooks/useUsers';
import { api, getErrorMessage } from '../lib/api';
import { ROLE_LABEL } from '../lib/constants';
import { FACEBOOK_HOSTS, GITHUB_HOSTS, isUrlOnHosts, LINKEDIN_HOSTS, normalizeUrl, PHONE_PATTERN } from '../lib/profile';
import { inputClass } from '../lib/styles';
import type { User } from '../types/api';

const optionalUrl = (hosts: string[], message: string) => z.string().trim().max(255, 'Tối đa 255 ký tự').refine((v) => isUrlOnHosts(v, hosts), message);

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(120, 'Tối đa 120 ký tự'),
  jobTitle: z.string().trim().max(120, 'Tối đa 120 ký tự'),
  phone: z.string().trim().refine((v) => v === '' || PHONE_PATTERN.test(v), 'Số điện thoại không hợp lệ'),
  contactEmail: z.string().trim().max(190).refine((v) => v === '' || z.string().email().safeParse(v).success, 'Email không hợp lệ'),
  bio: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  githubUrl: optionalUrl(GITHUB_HOSTS, 'Link phải thuộc github.com'),
  linkedinUrl: optionalUrl(LINKEDIN_HOSTS, 'Link phải thuộc linkedin.com'),
  facebookUrl: optionalUrl(FACEBOOK_HOSTS, 'Link phải thuộc facebook.com'),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự').max(128, 'Tối đa 128 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu nhập lại không khớp' });
type PasswordValues = z.infer<typeof passwordSchema>;

const toForm = (user: User): ProfileValues => ({
  name: user.name,
  jobTitle: user.jobTitle ?? '',
  phone: user.phone ?? '',
  contactEmail: user.contactEmail ?? '',
  bio: user.bio ?? '',
  githubUrl: user.githubUrl ?? '',
  linkedinUrl: user.linkedinUrl ?? '',
  facebookUrl: user.facebookUrl ?? '',
});

function ProfileForm({ user, onSaved }: { user: User; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const update = useUpdateUser(user.id);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toForm(user) });
  const bioLength = watch('bio').length;

  const onSubmit = async (values: ProfileValues) => {
    setServerError(null);
    try {
      // Chuỗi rỗng = xóa trường (backend đổi thành null)
      await update.mutateAsync({
        ...values,
        githubUrl: normalizeUrl(values.githubUrl),
        linkedinUrl: normalizeUrl(values.linkedinUrl),
        facebookUrl: normalizeUrl(values.facebookUrl),
      });
      await onSaved();
      reset(values);
      toast.show('Đã lưu hồ sơ', 'success');
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
      <InlineError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên" htmlFor="name" error={errors.name?.message}>
          <input id="name" autoComplete="name" className={inputClass} aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Chức danh" htmlFor="jobTitle" error={errors.jobTitle?.message}>
          <input id="jobTitle" placeholder="Ví dụ: Lập trình viên" className={inputClass} {...register('jobTitle')} />
        </Field>
        <Field label="Số điện thoại" htmlFor="phone" error={errors.phone?.message}>
          <input id="phone" type="tel" autoComplete="tel" placeholder="0901 234 567" className={inputClass} aria-invalid={!!errors.phone} {...register('phone')} />
        </Field>
        <Field label="Email liên hệ (Gmail...)" htmlFor="contactEmail" error={errors.contactEmail?.message} hint={`Để trống sẽ hiển thị email đăng nhập (${user.email})`}>
          <input id="contactEmail" type="email" placeholder="ban@gmail.com" className={inputClass} aria-invalid={!!errors.contactEmail} {...register('contactEmail')} />
        </Field>
      </div>
      <Field label="Giới thiệu" htmlFor="bio" error={errors.bio?.message} hint={`${bioLength}/500 ký tự`}>
        <textarea id="bio" rows={3} className={`${inputClass} resize-y`} aria-invalid={!!errors.bio} {...register('bio')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="GitHub" htmlFor="githubUrl" error={errors.githubUrl?.message}>
          <input id="githubUrl" placeholder="github.com/tên-bạn" className={inputClass} aria-invalid={!!errors.githubUrl} {...register('githubUrl')} />
        </Field>
        <Field label="LinkedIn" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message}>
          <input id="linkedinUrl" placeholder="linkedin.com/in/tên-bạn" className={inputClass} aria-invalid={!!errors.linkedinUrl} {...register('linkedinUrl')} />
        </Field>
        <Field label="Facebook" htmlFor="facebookUrl" error={errors.facebookUrl?.message}>
          <input id="facebookUrl" placeholder="facebook.com/tên-bạn" className={inputClass} aria-invalid={!!errors.facebookUrl} {...register('facebookUrl')} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={!isDirty || update.isPending} onClick={() => reset(toForm(user))}>
          Hoàn tác
        </Button>
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });

  const onSubmit = async (values: PasswordValues) => {
    setServerError(null);
    try {
      await api.post('/auth/change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
      // Backend thu hồi mọi phiên khi đổi mật khẩu => đăng nhập lại
      toast.show('Đã đổi mật khẩu, vui lòng đăng nhập lại', 'success');
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
      <InlineError message={serverError} />
      <Field label="Mật khẩu hiện tại" htmlFor="currentPassword" error={errors.currentPassword?.message}>
        <input id="currentPassword" type="password" autoComplete="current-password" className={inputClass} aria-invalid={!!errors.currentPassword} {...register('currentPassword')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mật khẩu mới" htmlFor="newPassword" error={errors.newPassword?.message} hint="Tối thiểu 8 ký tự">
          <input id="newPassword" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.newPassword} {...register('newPassword')} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Đổi mật khẩu sẽ đăng xuất bạn khỏi mọi thiết bị.</p>
        <Button type="submit" variant="secondary" loading={isSubmitting}>
          Đổi mật khẩu
        </Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title="Hồ sơ của tôi" description={`${ROLE_LABEL[user.role]} · ${user.email}. Đồng đội cùng dự án sẽ xem được thông tin liên hệ bạn điền ở đây.`} />
      <div className="mx-auto max-w-3xl space-y-6">
        <Card title="Ảnh đại diện">
          <AvatarEditor user={user} onChanged={refreshUser} />
        </Card>
        <Card title="Thông tin cá nhân">
          <ProfileForm user={user} onSaved={refreshUser} />
        </Card>
        <Card title="Bảo mật">
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
