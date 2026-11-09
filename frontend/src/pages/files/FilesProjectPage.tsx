import { ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { FilesBreadcrumb } from '../../components/files/FilesBreadcrumb';
import { FolderItem } from '../../components/files/FolderItem';
import { FolderToolbar } from '../../components/files/FolderToolbar';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/Badges';
import { useFileProject } from '../../hooks/useFolders';
import { useFolderParams } from '../../hooks/useFolderParams';
import { useViewMode } from '../../hooks/useViewMode';

const SORTS = ['name', 'updatedAt'] as const;
const SORT_OPTIONS = [
  { value: 'name', label: 'Tên' },
  { value: 'updatedAt', label: 'Cập nhật mới nhất' },
];

/** Cấp 2: "File chung của dự án" + mỗi task có file là một thư mục con */
export default function FilesProjectPage() {
  const projectId = Number(useParams().projectId);
  const [view, setView] = useViewMode();
  const params = useFolderParams(SORTS, { sortBy: 'name', order: 'asc' });
  const query = useFileProject(projectId, { sortBy: params.sortBy, order: params.order, page: params.page, includeEmpty: params.includeEmpty || undefined });
  const data = query.data;

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { project, common } = data;
  const nothing = common.fileCount === 0 && data.total === 0;
  const commonTo = `/files/projects/${project.id}/common`;

  return (
    <>
      <FilesBreadcrumb items={[{ label: 'Kho tài liệu', to: '/files' }, { label: project.name }]} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-xl font-semibold text-slate-900" title={project.name}>
          {project.name}
        </h2>
        <Link to={`/projects/${project.id}`}>
          <Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
            Mở dự án
          </Button>
        </Link>
      </div>

      <FolderToolbar
        view={view}
        onViewChange={setView}
        sortBy={params.sortBy}
        order={params.order}
        sortOptions={SORT_OPTIONS}
        onSortChange={params.setSort}
        includeEmpty={params.includeEmpty}
        onIncludeEmptyChange={params.setIncludeEmpty}
      />

      {nothing && !params.includeEmpty ? (
        <EmptyState
          title="Dự án chưa có file nào"
          description={data.canUpload ? 'Tải file lên mục "File chung của dự án", hoặc đính kèm file vào công việc.' : 'Khi có người đính kèm file vào dự án hoặc công việc, chúng sẽ hiện ở đây.'}
          action={
            <Link to={commonTo}>
              <Button variant="secondary">{data.canUpload ? 'Mở "File chung của dự án" để tải lên' : 'Mở "File chung của dự án"'}</Button>
            </Link>
          }
        />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          {view === 'grid' ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <FolderItem view="grid" kind="common" to={commonTo} name="File chung của dự án" stats={common} note="Đính trực tiếp vào dự án" />
              {data.items.map((t, index) => (
                <FolderItem key={t.id} view="grid" index={index + 1} kind="task" to={`/files/tasks/${t.id}`} name={t.name} stats={t} note={t.parent ? `Việc con của "${t.parent.title}"` : undefined} badge={<StatusBadge status={t.status} />} />
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-card">
              <FolderItem view="list" kind="common" to={commonTo} name="File chung của dự án" stats={common} note="Đính trực tiếp vào dự án" />
              {data.items.map((t) => (
                <FolderItem key={t.id} view="list" kind="task" to={`/files/tasks/${t.id}`} name={t.name} stats={t} note={t.parent ? `Việc con của "${t.parent.title}"` : undefined} badge={<StatusBadge status={t.status} />} />
              ))}
            </ul>
          )}
          {data.total === 0 && (
            <p className="mt-4 text-center text-sm text-slate-500">
              {params.includeEmpty ? 'Dự án chưa có công việc nào.' : 'Chưa có công việc nào có file. Bật "Hiện cả task chưa có file" để xem mọi công việc.'}
            </p>
          )}
          {data.total > 0 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={params.setPage} />}
        </div>
      )}
    </>
  );
}
