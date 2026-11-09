import { zodResolver } from '@hookform/resolvers/zod';
import { CheckSquare } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
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
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <CheckSquare className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Đăng ký TaskFlow</h1>
          <p className="mt-1 text-sm text-slate-500">Tạo tài khoản thành viên để nhận và theo dõi công việc</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Đăng ký
          </Button>
          <p className="text-center text-xs text-slate-500">Tài khoản mới có vai trò Thành viên. Quản trị viên có thể nâng quyền sau.</p>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
