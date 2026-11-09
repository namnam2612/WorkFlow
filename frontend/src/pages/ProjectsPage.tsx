import { Reveal } from '../components/fx/Reveal';
import { TiltCard } from '../components/fx/TiltCard';
import { AlertTriangle, FolderKanban, KanbanSquare, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useProjects } from '../hooks/useProjects';
import { formatDate } from '../lib/format';
import { inputClass } from '../lib/styles';

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const projectsQuery = useProjects(search.trim() || undefined);
  const canCreate = user?.role === 'admin' || user?.role === 'leader';

  return (
    <>
      <PageHeader
        title="Dự án"
        description="Danh sách dự án bạn tham gia hoặc quản lý"
        actions={
          canCreate && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Tạo dự án
            </Button>
          )
        }
      />

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên dự án..." className={`${inputClass} pl-9`} aria-label="Tìm dự án" />
      </div>

      {projectsQuery.isLoading ? (
        <PageLoader />
      ) : projectsQuery.isError ? (
        <ErrorState error={projectsQuery.error} onRetry={() => void projectsQuery.refetch()} />
      ) : projectsQuery.data && projectsQuery.data.length === 0 ? (
        <EmptyState
          title={search ? 'Không tìm thấy dự án phù hợp' : 'Chưa có dự án nào'}
          description={canCreate ? 'Hãy tạo dự án đầu tiên để bắt đầu giao việc.' : 'Bạn chưa được thêm vào dự án nào. Hãy liên hệ trưởng nhóm.'}
          action={canCreate && !search ? <Button onClick={() => setCreating(true)}>Tạo dự án</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectsQuery.data?.map((project, index) => (
            <Reveal key={project.id} index={index}>
            <TiltCard className="rounded-2xl border border-white/[0.08] bg-card hover:border-white/20">
            <article className="flex h-full flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] text-white/70">
                  <FolderKanban className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${project.id}`} className="block truncate font-semibold text-slate-900 hover:text-white/70">
                    {project.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(project.startDate)} → {formatDate(project.endDate)}
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600">{project.description || 'Chưa có mô tả'}</p>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {project.doneCount}/{project.taskCount} công việc
                  </span>
                  <span className="font-semibold text-slate-700">{project.progress}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${project.progress}%` }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.members.slice(0, 5).map((m) => (
                    <Avatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} size="sm" className="ring-2 ring-bg" />
                  ))}
                  {project.members.length > 5 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600 ring-2 ring-bg">+{project.members.length - 5}</span>
                  )}
                </div>
                {project.overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                    <AlertTriangle className="h-3.5 w-3.5" /> {project.overdueCount} quá hạn
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <Button variant="primary" size="sm" className="flex-1" icon={<KanbanSquare className="h-4 w-4" />} onClick={() => navigate(`/projects/${project.id}/board`)}>
                  Bảng Kanban
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => navigate(`/projects/${project.id}`)}>
                  Chi tiết
                </Button>
              </div>
            </article>
            </TiltCard>
            </Reveal>
          ))}
        </div>
      )}

      {creating && <ProjectFormModal open onClose={() => setCreating(false)} onSaved={(project) => navigate(`/projects/${project.id}`)} />}
    </>
  );
}
