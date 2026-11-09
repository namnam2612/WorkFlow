import { Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useAddWorklog, useDeleteWorklog, useWorklogs } from '../../hooks/useWorklogs';
import { getErrorMessage } from '../../lib/api';
import { formatMinutes, parseDuration } from '../../lib/duration';
import { formatDate } from '../../lib/format';
import { inputClass } from '../../lib/styles';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

const todayVn = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Ghi nhận thời gian làm việc: giờ thực tế của công việc = tổng các lần ghi */
export function WorkLogSection({ taskId, canLog, canModerate }: { taskId: number; canLog: boolean; canModerate: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const query = useWorklogs(taskId);
  const add = useAddWorklog(taskId);
  const remove = useDeleteWorklog(taskId);
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(todayVn());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const items = query.data?.items ?? [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const minutes = parseDuration(duration);
    if (minutes === null || minutes < 1 || minutes > 24 * 60) return setError('Nhập thời gian dạng "1g30", "90p" hoặc "1.5" (giờ), tối đa 24 giờ');
    setError(null);
    try {
      await add.mutateAsync({ minutes, workedOn: date, note: note.trim() || null });
      setDuration('');
      setNote('');
      toast.show(`Đã ghi nhận ${formatMinutes(minutes)}`, 'success');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card title={`Thời gian làm việc${query.data ? ` (${formatMinutes(query.data.totalMinutes)})` : ''}`} action={<Clock className="h-4 w-4 text-slate-400" aria-hidden />}>
      {canLog && (
        <form onSubmit={(e) => void submit(e)} className="mb-4 space-y-2" noValidate>
          <InlineError message={error} />
          <div className="flex flex-wrap gap-2">
            <input aria-label="Thời gian" placeholder="VD: 1g30, 90p, 1.5" value={duration} onChange={(e) => setDuration(e.target.value)} className={`${inputClass} w-36!`} />
            <input aria-label="Ngày làm việc" type="date" max={todayVn()} value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} w-auto!`} />
            <input aria-label="Ghi chú" placeholder="Ghi chú (tùy chọn)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} min-w-40 flex-1`} />
            <Button type="submit" loading={add.isPending}>
              Ghi nhận
            </Button>
          </div>
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có thời gian nào được ghi nhận.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((log) => (
            <li key={log.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={log.user.name} avatarUrl={log.user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{log.user.name}</span> · <span className="tabular-nums">{formatMinutes(log.minutes)}</span>
                </p>
                {log.note && <p className="truncate text-xs text-slate-500">{log.note}</p>}
              </div>
              <span className="tabular-nums text-xs text-slate-500">{formatDate(log.workedOn)}</span>
              {(log.userId === user?.id || canModerate) && (
                <button
                  type="button"
                  aria-label="Xóa bản ghi thời gian"
                  disabled={remove.isPending}
                  onClick={() => void remove.mutateAsync(log.id).catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
