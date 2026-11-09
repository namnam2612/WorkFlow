import type { ReactNode } from 'react';
import { Reveal } from '../fx/Reveal';

export function Card({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Reveal className={className}>
      <section className="h-full rounded-2xl border border-white/[0.08] bg-card transition-colors duration-300 hover:border-white/[0.14]">
        {(title || action) && (
          <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
            {title && <h2 className="eyebrow !tracking-[2px]">{title}</h2>}
            {action}
          </header>
        )}
        <div className="p-5">{children}</div>
      </section>
    </Reveal>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[clamp(30px,4.5vw,44px)] font-bold leading-none tracking-[-1.5px] text-white">{title}</h1>
        {description && <p className="mt-3 max-w-[520px] text-[15px] leading-[1.65] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
