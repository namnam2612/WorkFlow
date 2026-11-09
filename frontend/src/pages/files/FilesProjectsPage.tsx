import { FolderItem } from '../../components/files/FolderItem';
import { FolderToolbar } from '../../components/files/FolderToolbar';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useFileProjects } from '../../hooks/useFolders';
import { useFolderParams } from '../../hooks/useFolderParams';
import { useViewMode } from '../../hooks/useViewMode';

const SORTS = ['name', 'updatedAt'] as const;
const SORT_OPTIONS = [
  { value: 'name', label: 'Tên' },
  { value: 'updatedAt', label: 'Cập nhật mới nhất' },
];

/** Cấp 1: mỗi dự án người dùng được xem là một thư mục */
export default function FilesProjectsPage() {
  const [view, setView] = useViewMode();
  const params = useFolderParams(SORTS, { sortBy: 'name', order: 'asc' });
  const query = useFileProjects({ sortBy: params.sortBy, order: params.order, page: params.page });
  const data = query.data;

  return (
    <>
      <FolderToolbar view={view} onViewChange={setView} sortBy={params.sortBy} order={params.order} sortOptions={SORT_OPTIONS} onSortChange={params.setSort} />

      {query.isLoading ? (
        <PageLoader />
      ) : query.isError || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : data.total === 0 ? (
        <EmptyState title="Chưa có dự án nào" description="Bạn chưa thuộc dự án nào. Khi được thêm vào dự án, thư mục của dự án sẽ xuất hiện ở đây." />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          {view === 'grid' ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((p, index) => (
                <FolderItem key={p.id} view="grid" index={index} kind="project" to={`/files/projects/${p.id}`} name={p.name} stats={p} />
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-card">
              {data.items.map((p) => (
                <FolderItem key={p.id} view="list" kind="project" to={`/files/projects/${p.id}`} name={p.name} stats={p} />
              ))}
            </ul>
          )}
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={params.setPage} />
        </div>
      )}
    </>
  );
}
