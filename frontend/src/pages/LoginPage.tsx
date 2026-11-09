import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { InlineError } from '../components/ui/States';
import { getErrorMessage } from '../lib/api';
import { inputClass } from '../lib/styles';

const schema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@taskflow.vn' },
  { label: 'Leader', email: 'leader1@taskflow.vn' },
  { label: 'Member', email: 'member1@taskflow.vn' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={redirectTo} replace />;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <AuthShell
      eyebrow="Chào mừng trở lại"
      title="Đăng nhập."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="link-underline text-white">
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4">
        <InlineError message={serverError} />
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="username" placeholder="ban@congty.vn" className={inputClass} {...register('email')} />
        </Field>
        <Field label="Mật khẩu" htmlFor="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" className={inputClass} {...register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Đăng nhập
        </Button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-6 border-t border-white/[0.08] pt-4 text-xs text-muted">
          Tài khoản mẫu (mật khẩu <code className="font-semibold text-white">Password123!</code>):
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setValue('email', account.email);
                  setValue('password', 'Password123!');
                }}
                className="rounded-full border border-white/[0.08] px-3 py-1 font-medium text-slate-600 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
