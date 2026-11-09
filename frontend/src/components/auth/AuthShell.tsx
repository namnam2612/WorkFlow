import { lazy, Suspense, type ReactNode } from 'react';
import { BrandMark } from '../ui/Brand';
import { ThemeToggle } from '../ui/ThemeToggle';

const HeroScene = lazy(() => import('../fx/HeroScene'));

interface AuthShellProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Khung chung cho đăng nhập / đăng ký: lưới 2 cột (hero 3D + biểu mẫu), mobile đưa cảnh 3D lên trên. */
export function AuthShell({ eyebrow, title, children, footer }: AuthShellProps) {
  return (
    <div className="relative mx-auto grid min-h-full w-full max-w-[1400px] grid-cols-1 items-center gap-6 px-5 py-8 md:px-12 lg:grid-cols-2 lg:gap-12">
      <ThemeToggle className="absolute right-5 top-8 z-10 animate-fade-up md:right-12" />
      <section className="relative flex flex-col justify-center lg:min-h-[80vh]">
        <div className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <BrandMark className="text-xl" />
        </div>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-white)_9%,transparent),transparent_65%)] [animation:pulse-glow_4s_ease-in-out_infinite]" />
        <Suspense fallback={null}>
          <HeroScene className="h-[220px] w-full sm:h-[300px] lg:absolute lg:inset-x-0 lg:top-0 lg:h-[58%]" />
        </Suspense>
        <div className="relative mt-4 lg:mt-auto">
          <h1 className="hero-title animate-fade-up" style={{ animationDelay: '0.3s' }}>
            Giao việc rõ ràng.
            <span>Đúng hạn từng việc.</span>
          </h1>
          <p className="mt-6 max-w-[420px] text-[15px] leading-[1.7] text-muted animate-fade-up" style={{ animationDelay: '0.5s' }}>
            Không chỉ quản lý. Chúng tôi giúp cả nhóm cùng nhìn một tiến độ.
          </p>
        </div>
      </section>

      <section className="animate-fade-up w-full max-w-md justify-self-center lg:justify-self-end" style={{ animationDelay: '0.5s' }}>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 className="mb-6 text-[clamp(30px,4.5vw,44px)] font-bold leading-none tracking-[-1.5px]">{title}</h2>
        <div className="rounded-3xl border border-white/[0.08] bg-card p-6 shadow-[0_22px_50px_var(--shadow-lift)] sm:p-8">{children}</div>
        {footer && <div className="mt-5 text-sm text-muted">{footer}</div>}
      </section>
    </div>
  );
}
