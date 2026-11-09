import { Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useCreateGuestLink, useGuestLinks, useRevokeGuestLink } from '../../hooks/useGuestLinks';
import { getErrorMessage } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { inputClass } from '../../lib/styles';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Quản lý liên kết cổng khách hàng: tạo (hiện URL đúng một lần), xem lượt xem, thu hồi */
export function GuestLinksModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const query = useGuestLinks(projectId, true);
  const create = useCreateGuestLink(projectId);
  const revoke = useRevokeGuestLink();
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Hãy đặt tên cho liên kết (vd tên khách hàng)');
    setError(null);
    try {
      const link = await create.mutateAsync({ name: name.trim(), ...(days ? { expiresInDays: Number(days) } : {}) });
      setFresh(`${window.location.origin}/portal/${link.token}`);
      setName('');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show('Đã sao chép liên kết', 'success');
    } catch {
      toast.show('Không sao chép được, hãy chọn và copy thủ công', 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title="Cổng khách hàng" size="lg">
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Tạo liên kết để khách hàng xem roadmap của dự án (tiến độ, sprint, epic, phiên bản) mà không cần tài khoản. Khách chỉ đọc; không thấy người, bình luận, file hay công việc chi tiết.
        </p>
        <InlineError message={error} />
        {fresh && (
          <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3">
            <p className="mb-2 text-sm font-medium text-slate-900">Liên kết mới — hãy sao chép ngay, sau này sẽ không xem lại được:</p>
            <div className="flex gap-2">
              <input readOnly aria-label="Liên kết mới" value={fresh} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} font-mono text-xs`} />
              <Button icon={<Copy className="h-4 w-4" />} onClick={() => void copy(fresh)}>
                Sao chép
              </Button>
            </div>
          </div>
        )}
        <form onSubmit={(e) => void submit(e)} className="flex flex-wrap gap-2" noValidate>
          <input aria-label="Tên liên kết" placeholder="Tên (vd Công ty ABC)" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={`${inputClass} min-w-48 flex-1`} />
          <select aria-label="Thời hạn" value={days} onChange={(e) => setDays(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">Không hết hạn</option>
            <option value="7">7 ngày</option>
            <option value="30">30 ngày</option>
            <option value="90">90 ngày</option>
          </select>
          <Button type="submit" icon={<Link2 className="h-4 w-4" />} loading={create.isPending}>
            Tạo liên kết
          </Button>
        </form>
        <ul className="divide-y divide-slate-100">
          {(query.data ?? []).map((l) => {
            const expired = l.expiresAt !== null && new Date(l.expiresAt).getTime() <= Date.now();
            const inactive = l.revokedAt !== null || expired;
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={inactive ? 'text-sm font-medium text-slate-500 line-through' : 'text-sm font-medium text-slate-900'}>
                    {l.name} <span className="font-mono text-xs text-slate-500">{l.tokenPrefix}…</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Tạo {formatDate(l.createdAt)} · {l.expiresAt ? `hết hạn ${formatDate(l.expiresAt)}` : 'không hết hạn'} · {l.viewCount} lượt xem{l.lastViewedAt ? `, gần nhất ${formatDateTime(l.lastViewedAt)}` : ''}
                  </p>
                </div>
                {l.revokedAt ? (
                  <span className="text-xs text-slate-500">Đã thu hồi</span>
                ) : expired ? (
                  <span className="text-xs text-slate-500">Đã hết hạn</span>
                ) : (
                  <Button size="sm" variant="danger" loading={revoke.isPending} onClick={() => void revoke.mutateAsync(l.id).then(() => toast.show('Đã thu hồi liên kết', 'success')).catch((e: unknown) => toast.show(getErrorMessage(e), 'error'))}>
                    Thu hồi
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
