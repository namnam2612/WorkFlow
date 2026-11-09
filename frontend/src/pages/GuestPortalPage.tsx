import { Eye, Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { BrandMark } from '../components/ui/Brand';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { formatDate } from '../lib/format';
import type { PortalData } from '../types/api';

const SPRINT_LABEL = { planned: 'Kế hoạch', active: 'Đang thực hiện', completed: 'Hoàn thành' } as const;

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-white transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

/** Trang roadmap công khai cho khách hàng: chỉ đọc, không cần đăng nhập, không có điều hướng vào hệ thống */
export default function GuestPortalPage() {
  const { token = '' } = useParams();
  // fetch trực tiếp (không qua api.ts) để không gửi/làm mới phiên đăng nhập của người dùng nội bộ
  const query = useQuery({
    queryKey: ['portal', token],
    retry: false,
    queryFn: async (): Promise<PortalData> => {
      const response = await fetch(`/api/public/portal/${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error(response.status === 404 ? 'Liên kết không hợp lệ hoặc đã hết hạn' : 'Không thể tải dữ liệu, vui lòng thử lại sau');
      return (await response.json()) as PortalData;
    },
  });
  const data = query.data;

  return (
    <div className="min-h-screen bg-bg text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6">
        <BrandMark />
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3 py-1 text-xs text-slate-600">
            <Eye className="h-3.5 w-3.5" aria-hidden /> Chỉ xem
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-20">
        {query.isLoading ? (
          <p className="py-20 text-center text-sm text-slate-500">Đang tải...</p>
        ) : query.isError || !data ? (
          <div className="py-24 text-center">
            <h1 className="text-2xl font-bold">Không thể mở roadmap</h1>
            <p className="mt-2 text-sm text-slate-500">{query.error instanceof Error ? query.error.message : 'Đã có lỗi xảy ra'}</p>
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h1 className="text-[clamp(30px,5vw,46px)] font-bold leading-tight tracking-[-1.5px]">{data.project.name}</h1>
              {data.project.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{data.project.description}</p>}
              <p className="mt-2 text-xs text-slate-500">
                {data.project.startDate || data.project.endDate ? `${formatDate(data.project.startDate)} → ${formatDate(data.project.endDate)} · ` : ''}Cập nhật {formatDate(data.generatedAt)}
              </p>
              <div className="mt-5 max-w-md">
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">Tiến độ tổng thể</span>
                  <span className="text-2xl font-bold tabular-nums">{data.project.progress}%</span>
                </div>
                <Bar value={data.project.progress} />
              </div>
            </section>

            {data.epics.length > 0 && (
              <section className="mb-10">
                <h2 className="eyebrow mb-4">Hạng mục chính</h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {data.epics.map((e) => (
                    <li key={e.title} className="rounded-2xl border border-white/[0.08] bg-card p-4">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <p className="font-medium">{e.title}</p>
                        <span className="text-sm tabular-nums text-slate-600">{e.progress}%</span>
                      </div>
                      <Bar value={e.progress} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.sprints.length > 0 && (
              <section className="mb-10">
                <h2 className="eyebrow mb-4">Lộ trình theo giai đoạn</h2>
                <ol className="space-y-3">
                  {data.sprints.map((s) => (
                    <li key={s.name} className="rounded-2xl border border-white/[0.08] bg-card p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">{s.name}</p>
                        <span className="text-xs text-slate-500">
                          {SPRINT_LABEL[s.status]} · {formatDate(s.startDate)} → {formatDate(s.endDate)}
                        </span>
                      </div>
                      {s.goal && <p className="mt-1 text-sm text-slate-600">{s.goal}</p>}
                      <div className="mt-3 flex items-center gap-3">
                        <Bar value={s.progress} />
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-600">{s.progress}%</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {data.releases.length > 0 && (
              <section>
                <h2 className="eyebrow mb-4">Phiên bản phát hành</h2>
                <ul className="space-y-3">
                  {data.releases.map((r) => (
                    <li key={r.version} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-card p-4">
                      <Rocket className={r.status === 'released' ? 'mt-0.5 h-5 w-5 text-emerald-500' : 'mt-0.5 h-5 w-5 text-slate-500'} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {r.version}
                          {r.name ? ` — ${r.name}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">{r.status === 'released' ? `Đã phát hành ${formatDate(r.releasedAt)}` : 'Sắp phát hành'}</p>
                        {r.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{r.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
