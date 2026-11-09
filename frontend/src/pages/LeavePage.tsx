import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { EmptyState, ErrorState, InlineError, PageLoader } from '../components/ui/States';
import { useToast } from '../components/ui/useToast';
import { useCancelLeave, useCreateLeave, useLeaves, useReviewLeave } from '../hooks/useLeaves';
import { getErrorMessage } from '../lib/api';
import { LEAVE_STATUS_META, LEAVE_TYPE_LABEL } from '../lib/constants';
import { formatDate } from '../lib/format';
import { inputClass } from '../lib/styles';
import type { Leave, LeaveType } from '../types/api';

const BASE = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';
const todayVn = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const plusDays = (days: number) => new Date(Date.now() + 7 * 60 * 60 * 1000 + days * 86400000).toISOString().slice(0, 10);

const range = (l: Leave) => (l.startDate === l.endDate ? formatDate(l.startDate) : `${formatDate(l.startDate)} → ${formatDate(l.endDate)}`);

function LeaveRow({ leave, mine }: { leave: Leave; mine?: boolean }) {
  const toast = useToast();
  const cancel = useCancelLeave();
  const review = useReviewLeave();
  const [note, setNote] = useState('');
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.show(ok, 'success');
    } catch (error) {
      toast.show(getErrorMessage(error), 'error');
    }
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        {!mine && <Avatar name={leave.user.name} avatarUrl={leave.user.avatarUrl} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {!mine && <span>{leave.user.name} · </span>}
            {range(leave)} · {LEAVE_TYPE_LABEL[leave.type]}
          </p>
          {leave.reason && <p className="truncate text-xs text-slate-500">{leave.reason}</p>}
          {leave.reviewNote && <p className="truncate text-xs text-slate-500">Ghi chú duyệt: {leave.reviewNote}</p>}
        </div>
        <span className={clsx(BASE, LEAVE_STATUS_META[leave.status].badge)}>{LEAVE_STATUS_META[leave.status].label}</span>
        {leave.canCancel && (
          <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => void act(() => cancel.mutateAsync(leave.id), 'Đã hủy đơn nghỉ')}>
            Hủy đơn
          </Button>
        )}
      </div>
      {leave.canReview && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-10">
          <input aria-label="Ghi chú duyệt" placeholder="Ghi chú (tùy chọn)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={`${inputClass} min-w-48 flex-1`} />
          <Button size="sm" icon={<Check className="h-4 w-4" />} loading={review.isPending} onClick={() => void act(() => review.mutateAsync({ id: leave.id, approve: true, note: note.trim() || null }), 'Đã duyệt')}>
            Duyệt
          </Button>
          <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} loading={review.isPending} onClick={() => void act(() => review.mutateAsync({ id: leave.id, approve: false, note: note.trim() || null }), 'Đã từ chối')}>
            Từ chối
          </Button>
        </div>
      )}
    </li>
  );
}

export default function LeavePage() {
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateLeave();
  const query = useLeaves({ from: plusDays(-90), to: plusDays(120) });
  const [type, setType] = useState<LeaveType>('annual');
  const [start, setStart] = useState(todayVn());
  const [end, setEnd] = useState(todayVn());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (end < start) return setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    setError(null);
    try {
      const leave = await create.mutateAsync({ startDate: start, endDate: end, type, reason: reason.trim() || null });
      toast.show(leave && (leave as Leave).status === 'approved' ? 'Đã ghi nhận nghỉ phép' : 'Đã gửi đơn nghỉ, chờ duyệt', 'success');
      setReason('');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const all = query.data;
  const mine = all.filter((l) => l.user.id === user?.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const toReview = all.filter((l) => l.canReview);
  const today = todayVn();
  const absences = all.filter((l) => l.status === 'approved' && l.endDate.slice(0, 10) >= today && l.user.id !== user?.id);

  return (
    <>
      <PageHeader title="Nghỉ phép" description="Xin nghỉ, duyệt đơn và xem ai đang vắng để nắm capacity thực tế của nhóm" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {toReview.length > 0 && (
            <Card title={`Chờ bạn duyệt (${toReview.length})`}>
              <ul className="divide-y divide-slate-100">
                {toReview.map((l) => (
                  <LeaveRow key={l.id} leave={l} />
                ))}
              </ul>
            </Card>
          )}
          <Card title="Đơn nghỉ của tôi">
            {mine.length === 0 ? (
              <p className="text-sm text-slate-500">Bạn chưa có đơn nghỉ nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {mine.map((l) => (
                  <LeaveRow key={l.id} leave={l} mine />
                ))}
              </ul>
            )}
          </Card>
          <Card title="Ai đang / sắp vắng">
            {absences.length === 0 ? (
              <EmptyState title="Không ai nghỉ sắp tới" description="Đồng đội cùng dự án hoặc nhóm có đơn nghỉ đã duyệt sẽ hiện ở đây." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {absences.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={l.user.name} avatarUrl={l.user.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{l.user.name}</span>
                    <span className="text-xs tabular-nums text-slate-500">{range(l)}</span>
                    <span className="text-xs text-slate-500">{LEAVE_TYPE_LABEL[l.type]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Xin nghỉ">
          <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
            <InlineError message={error} />
            <Field label="Loại nghỉ" htmlFor="leave-type">
              <select id="leave-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
                {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Từ ngày" htmlFor="leave-start">
                <input id="leave-start" type="date" className={inputClass} value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
              </Field>
              <Field label="Đến ngày" htmlFor="leave-end">
                <input id="leave-end" type="date" min={start} className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <Field label="Lý do" htmlFor="leave-reason" hint="Chỉ bạn và người duyệt thấy lý do.">
              <textarea id="leave-reason" rows={3} className={inputClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button type="submit" loading={create.isPending} className="w-full">
              {user?.role === 'member' ? 'Gửi đơn nghỉ' : 'Ghi nhận nghỉ'}
            </Button>
            {user?.role !== 'member' && <p className="text-xs text-slate-500">Đơn của trưởng nhóm / quản trị viên được tự duyệt.</p>}
          </form>
        </Card>
      </div>
    </>
  );
}
