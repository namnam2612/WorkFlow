import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useTheme } from '../components/ui/useTheme';
import { useProject } from '../hooks/useProjects';
import { useBurndown, useSprints, useTimesheet, useVelocity } from '../hooks/useSprints';
import { CHART_CHROME } from '../lib/constants';
import { formatMinutes } from '../lib/duration';
import { inputClass } from '../lib/styles';

const DAY_MS = 24 * 60 * 60 * 1000;
const vnDay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const vnDateInput = (d: Date) => new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

function BurndownCard({ projectId }: { projectId: number }) {
  const { theme } = useTheme();
  const chrome = CHART_CHROME[theme];
  const sprints = useSprints(projectId);
  const list = (sprints.data ?? []).filter((s) => s.status !== 'planned');
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked ?? list.find((s) => s.status === 'active')?.id ?? list[0]?.id;
  const burndown = useBurndown(current);

  return (
    <Card
      title="Burndown"
      action={
        list.length > 0 && (
          <select aria-label="Chọn sprint" value={current ?? ''} onChange={(e) => setPicked(Number(e.target.value))} className={`${inputClass} w-auto! py-1 text-xs`}>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )
      }
    >
      {sprints.isLoading || (current !== undefined && burndown.isLoading) ? (
        <PageLoader />
      ) : current === undefined || !burndown.data ? (
        <EmptyState title="Chưa có sprint nào đã bắt đầu" description="Burndown hiện khi bạn bắt đầu một sprint ở trang Backlog." />
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">
            Đơn vị: {burndown.data.unit === 'points' ? 'Story Point' : 'số việc (chưa ước lượng điểm)'} · cam kết {burndown.data.committed}, phạm vi hiện tại {burndown.data.scope}
          </p>
          <div style={{ height: 280 }} role="img" aria-label="Biểu đồ burndown">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndown.data.points.map((p) => ({ ...p, label: vnDay(p.date) }))} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: chrome.ink }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chrome.ink }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.grid}`, borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="linear" dataKey="ideal" name="Lý tưởng" stroke={chrome.ink} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="remaining" name="Còn lại" stroke={chrome.line} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}

function VelocityCard({ projectId }: { projectId: number }) {
  const { theme } = useTheme();
  const chrome = CHART_CHROME[theme];
  const velocity = useVelocity(projectId);
  const data = velocity.data;
  return (
    <Card title="Velocity" action={data && data.items.length > 0 && <span className="text-xs text-slate-500">Trung bình 3 sprint gần nhất: {data.average} điểm</span>}>
      {velocity.isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Chưa có sprint nào kết thúc" description="Velocity là số điểm hoàn thành của mỗi sprint đã kết thúc." />
      ) : (
        <div style={{ height: 260 }} role="img" aria-label="Biểu đồ velocity">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.items} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: chrome.ink }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chrome.ink }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: chrome.cursor }} contentStyle={{ background: chrome.surface, border: `1px solid ${chrome.grid}`, borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="committed" name="Cam kết" fill={chrome.ink} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="completed" name="Hoàn thành" fill={chrome.accent} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function TimesheetCard({ projectId }: { projectId: number }) {
  const today = new Date();
  const [days, setDays] = useState(14);
  const from = vnDateInput(new Date(today.getTime() - (days - 1) * DAY_MS));
  const to = vnDateInput(today);
  const sheet = useTimesheet(projectId, from, to);
  const data = sheet.data;
  return (
    <Card
      title="Chấm công"
      action={
        <select aria-label="Khoảng thời gian" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${inputClass} w-auto! py-1 text-xs`}>
          <option value={7}>7 ngày</option>
          <option value={14}>14 ngày</option>
          <option value={30}>30 ngày</option>
          <option value={90}>90 ngày</option>
        </select>
      }
    >
      {sheet.isLoading ? (
        <PageLoader />
      ) : sheet.isError || !data ? (
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      ) : data.byUser.length === 0 ? (
        <EmptyState title="Chưa có thời gian nào được ghi" description="Thành viên ghi nhận thời gian ngay trong trang chi tiết công việc." />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            Tổng: <span className="font-semibold text-slate-900">{formatMinutes(data.totalMinutes)}</span> ({(data.totalMinutes / 60).toFixed(1)} giờ)
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4 font-semibold">Thành viên</th>
                <th className="px-3 py-2 text-right font-semibold">Số việc</th>
                <th className="px-3 py-2 text-right font-semibold">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byUser.map((row) => (
                <tr key={row.user.id}>
                  <td className="py-2 pr-4 font-medium text-slate-800">{row.user.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{row.taskCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">{formatMinutes(row.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const projectId = Number(useParams().id);
  const projectQuery = useProject(projectId);
  if (projectQuery.isLoading) return <PageLoader />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  const project = projectQuery.data;
  return (
    <>
      <Link to={`/projects/${project.id}/backlog`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Backlog &amp; Sprint
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Báo cáo · {project.name}</h1>
        <p className="text-sm text-slate-500">Burndown của sprint, velocity qua các sprint và chấm công của nhóm</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BurndownCard projectId={projectId} />
        <VelocityCard projectId={projectId} />
        <div className="lg:col-span-2">
          <TimesheetCard projectId={projectId} />
        </div>
      </div>
    </>
  );
}
