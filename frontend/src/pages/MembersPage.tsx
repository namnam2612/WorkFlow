import { Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { StatChips } from '../components/users/StatChips';
import { UserFormModal } from '../components/users/UserFormModal';
import { useUsers, type UserWithStats } from '../hooks/useUsers';
import { ROLE_LABEL } from '../lib/constants';
import { inputClass } from '../lib/styles';
import type { Role } from '../types/api';

export default function MembersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserWithStats | null>(null);

  const usersQuery = useUsers({ search: search.trim() || undefined, role: role || undefined });

  return (
    <>
      <PageHeader
        title="Thành viên"
        description={isAdmin ? 'Quản lý người dùng và vai trò trong hệ thống' : 'Đồng đội trong các dự án của bạn'}
        actions={
          isAdmin && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Thêm người dùng
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc email..." className={`${inputClass} pl-9`} aria-label="Tìm thành viên" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as Role | '')} className={`${inputClass} sm:w-48`} aria-label="Lọc theo vai trò">
          <option value="">Mọi vai trò</option>
          {(['admin', 'leader', 'member'] as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {usersQuery.isLoading ? (
        <PageLoader />
      ) : usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} />
      ) : usersQuery.data && usersQuery.data.items.length === 0 ? (
        <EmptyState title="Không tìm thấy thành viên" description="Thử đổi từ khóa hoặc bộ lọc vai trò." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {usersQuery.data?.items.map((member) => (
            <article key={member.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-start gap-3">
                <Avatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <Link to={`/members/${member.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700">
                    {member.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{ROLE_LABEL[member.role]}</span>
                    {!member.isActive && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">Đã vô hiệu hóa</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button type="button" aria-label={`Sửa ${member.name}`} onClick={() => setEditing(member)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-4">
                <StatChips stats={member.stats} />
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && <UserFormModal open onClose={() => setCreating(false)} />}
      {editing && <UserFormModal open user={editing} isSelf={editing.id === user?.id} onClose={() => setEditing(null)} />}
    </>
  );
}
