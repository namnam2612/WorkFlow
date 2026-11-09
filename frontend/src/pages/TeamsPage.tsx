import { Plus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Reveal } from '../components/fx/Reveal';
import { TiltCard } from '../components/fx/TiltCard';
import { TeamFormModal } from '../components/teams/TeamFormModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useTeams } from '../hooks/useTeams';

export default function TeamsPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const query = useTeams();
  const canCreate = user?.role === 'admin' || user?.role === 'leader';

  return (
    <>
      <PageHeader
        title="Nhóm"
        description="Các nhóm làm việc, thành viên theo chuyên môn và dự án họ phụ trách"
        actions={
          canCreate && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Tạo nhóm
            </Button>
          )
        }
      />
      {query.isLoading ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title="Chưa có nhóm nào" description={canCreate ? 'Tạo nhóm đầu tiên để gom thành viên và gán dự án.' : 'Bạn chưa thuộc nhóm nào. Hãy liên hệ trưởng nhóm.'} action={canCreate ? <Button onClick={() => setCreating(true)}>Tạo nhóm</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.map((team, index) => (
            <Reveal key={team.id} index={index}>
              <TiltCard className="rounded-2xl border border-white/[0.08] bg-card hover:border-white/20">
                <Link to={`/teams/${team.id}`} className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-white/70">
                      <UsersRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{team.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {team.memberCount} thành viên · {team.projectCount} dự án
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600">{team.description || 'Chưa có mô tả'}</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-xs text-slate-500">
                    <Avatar name={team.leader.name} avatarUrl={team.leader.avatarUrl} size="sm" />
                    Trưởng nhóm: <span className="font-medium text-slate-800">{team.leader.name}</span>
                  </div>
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      )}
      {creating && <TeamFormModal onClose={() => setCreating(false)} />}
    </>
  );
}
