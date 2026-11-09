import { zodResolver } from '@hookform/resolvers/zod';
import { CheckSquare } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
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
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <CheckSquare className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Đăng nhập TaskFlow</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý công việc nhóm rõ ràng, đúng hạn</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <InlineError message={serverError} />
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" autoComplete="username" placeholder="ban@congty.vn" className={inputClass} {...register('email')} />
          </Field>
          <Field label="Mật khẩu" htmlFor="password" error={errors.password?.message}>
            <input id="password" type="password" autoComplete="current-password" className={inputClass} {...register('password')} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Đăng nhập
          </Button>
        </form>

        {import.meta.env.DEV && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/60 p-3 text-center text-xs text-slate-500">
            Tài khoản mẫu (mật khẩu <code className="font-semibold">Password123!</code>):
            <div className="mt-2 flex justify-center gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setValue('email', account.email);
                    setValue('password', 'Password123!');
                  }}
                  className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-200"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
