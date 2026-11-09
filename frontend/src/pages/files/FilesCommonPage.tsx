import { ExternalLink, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FilesBreadcrumb } from '../../components/files/FilesBreadcrumb';
import { FolderFiles } from '../../components/files/FolderFiles';
import { FolderToolbar } from '../../components/files/FolderToolbar';
import { UploadFilesModal } from '../../components/files/UploadFilesModal';
import { Button } from '../../components/ui/Button';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { useProjectCommonFiles } from '../../hooks/useFolders';
import { useFolderParams } from '../../hooks/useFolderParams';
import { useViewMode } from '../../hooks/useViewMode';

const SORTS = ['name', 'updatedAt', 'size'] as const;
const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Mới gửi' },
  { value: 'name', label: 'Tên' },
  { value: 'size', label: 'Dung lượng' },
];

/** "File chung của dự án": các file đính trực tiếp vào dự án (không thuộc task nào) */
export default function FilesCommonPage() {
  const projectId = Number(useParams().projectId);
  const [view, setView] = useViewMode();
  const params = useFolderParams(SORTS, { sortBy: 'updatedAt', order: 'desc' });
  const query = useProjectCommonFiles(projectId, { sortBy: params.sortBy, order: params.order, page: params.page });
  const [uploading, setUploading] = useState(false);
  const data = query.data;

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { project } = data;
  const uploadButton = data.canUpload ? (
    <Button icon={<Upload className="h-4 w-4" />} onClick={() => setUploading(true)}>
      Tải lên file
    </Button>
  ) : undefined;

  return (
    <>
      <FilesBreadcrumb items={[{ label: 'Kho tài liệu', to: '/files' }, { label: project.name, to: `/files/projects/${project.id}` }, { label: 'File chung của dự án' }]} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-xl font-semibold text-slate-900">File chung của dự án</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/projects/${project.id}`}>
            <Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
              Mở dự án
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
        emptyTitle="Dự án chưa có file chung nào"
        emptyDescription={data.canUpload ? 'Tải lên các file dùng chung cho cả dự án (hợp đồng, kế hoạch...).' : 'Chỉ trưởng nhóm của dự án và quản trị viên mới tải file lên được đây.'}
        emptyAction={uploadButton}
      />
      {uploading && <UploadFilesModal open onClose={() => setUploading(false)} scope={{ kind: 'project', id: project.id }} targetLabel="dự án" />}
    </>
  );
}
