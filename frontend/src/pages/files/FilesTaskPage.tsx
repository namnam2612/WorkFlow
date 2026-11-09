import { ExternalLink, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FilesBreadcrumb } from '../../components/files/FilesBreadcrumb';
import { FolderFiles } from '../../components/files/FolderFiles';
import { FolderToolbar } from '../../components/files/FolderToolbar';
import { UploadFilesModal } from '../../components/files/UploadFilesModal';
import { StatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { useFileTask } from '../../hooks/useFolders';
import { useFolderParams } from '../../hooks/useFolderParams';
import { useViewMode } from '../../hooks/useViewMode';

const SORTS = ['name', 'updatedAt', 'size'] as const;
const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Mới gửi' },
  { value: 'name', label: 'Tên' },
  { value: 'size', label: 'Dung lượng' },
];

/** Cấp 3: tất cả file của một công việc */
export default function FilesTaskPage() {
  const taskId = Number(useParams().taskId);
  const [view, setView] = useViewMode();
  const params = useFolderParams(SORTS, { sortBy: 'updatedAt', order: 'desc' });
  const query = useFileTask(taskId, { sortBy: params.sortBy, order: params.order, page: params.page });
  const [uploading, setUploading] = useState(false);
  const data = query.data;

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { task } = data;
  const uploadButton = data.canUpload ? (
    <Button icon={<Upload className="h-4 w-4" />} onClick={() => setUploading(true)}>
      Tải lên file
    </Button>
  ) : undefined;

  return (
    <>
      <FilesBreadcrumb items={[{ label: 'Kho tài liệu', to: '/files' }, { label: task.projectName, to: `/files/projects/${task.projectId}` }, { label: task.title }]} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="min-w-0 truncate text-xl font-semibold text-slate-900" title={task.title}>
            {task.title}
          </h2>
          <StatusBadge status={task.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/tasks/${task.id}`}>
            <Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
              Mở công việc
            </Button>
          </Link>
          {uploadButton}
        </div>
      </div>

      <FolderToolbar view={view} onViewChange={setView} sortBy={params.sortBy} order={params.order} sortOptions={SORT_OPTIONS} onSortChange={params.setSort} />
      <FolderFiles
        data={data}
        isLoading={false}
        error={null}
        onRetry={() => void query.refetch()}
        isPlaceholder={query.isPlaceholderData}
        view={view}
        onPage={params.setPage}
        emptyTitle="Công việc chưa có file nào"
        emptyDescription="Tải lên file để đính kèm vào công việc này."
        emptyAction={uploadButton}
      />
      {uploading && <UploadFilesModal open onClose={() => setUploading(false)} scope={{ kind: 'task', id: task.id }} targetLabel="công việc" />}
    </>
  );
}
