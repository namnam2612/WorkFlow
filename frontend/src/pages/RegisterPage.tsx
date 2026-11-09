import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { InlineError } from '../components/ui/States';
import { getErrorMessage } from '../lib/api';
import { inputClass } from '../lib/styles';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(120, 'Tối đa 120 ký tự'),
    email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128, 'Tối đa 128 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu nhập lại không khớp' });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { user, register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '', confirmPassword: '' } });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await registerAccount({ name: values.name, email: values.email, password: values.password });
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <AuthShell
      eyebrow="Bắt đầu miễn phí"
      title="Đăng ký."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="link-underline text-white">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
        <InlineError message={serverError} />
        <Field label="Họ tên" htmlFor="name" error={errors.name?.message}>
          <input id="name" autoComplete="name" className={inputClass} {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="username" placeholder="ban@congty.vn" className={inputClass} {...register('email')} />
        </Field>
        <Field label="Mật khẩu" htmlFor="password" error={errors.password?.message} hint="Tối thiểu 8 ký tự">
          <input id="password" type="password" autoComplete="new-password" className={inputClass} {...register('password')} />
        </Field>
        <Field label="Nhập lại mật khẩu" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClass} {...register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Đăng ký
        </Button>
        <p className="text-center text-xs text-muted">Tài khoản mới có vai trò Thành viên. Quản trị viên có thể nâng quyền sau.</p>
      </form>
    </AuthShell>
  );
}
