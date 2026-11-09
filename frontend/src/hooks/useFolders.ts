import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Attachment, FileListParams, FolderParams, Paginated, ProjectContents, ProjectFilesPage, ProjectFolder, TaskFilesPage } from '../types/api';

/** Kho tài liệu dạng thư mục. Khóa truy vấn bắt đầu bằng 'files' để invalidateTaskRelated làm mới được sau khi upload/xóa. */

export function useFileProjects(params: FolderParams) {
  return useQuery({
    queryKey: ['files', 'projects', params],
    queryFn: () => api.get<Paginated<ProjectFolder>>('/files/projects', { ...params }),
    placeholderData: keepPreviousData,
  });
}

export function useFileProject(projectId: number, params: FolderParams) {
  return useQuery({
    queryKey: ['files', 'project', projectId, params],
    queryFn: () => api.get<ProjectContents>(`/files/projects/${projectId}`, { ...params }),
    placeholderData: keepPreviousData,
    enabled: !Number.isNaN(projectId),
  });
}

export function useProjectCommonFiles(projectId: number, params: FileListParams) {
  return useQuery({
    queryKey: ['files', 'common', projectId, params],
    queryFn: () => api.get<ProjectFilesPage>(`/files/projects/${projectId}/files`, { ...params }),
    placeholderData: keepPreviousData,
    enabled: !Number.isNaN(projectId),
  });
}

export function useFileTask(taskId: number, params: FileListParams) {
  return useQuery({
    queryKey: ['files', 'task', taskId, params],
    queryFn: () => api.get<TaskFilesPage>(`/files/tasks/${taskId}`, { ...params }),
    placeholderData: keepPreviousData,
    enabled: !Number.isNaN(taskId),
  });
}

/** Tìm file theo tên trên toàn kho (chỉ chạy khi có từ khóa) */
export function useFileSearch(q: string, page: number) {
  return useQuery({
    queryKey: ['files', 'search', q, page],
    queryFn: () => api.get<Paginated<Attachment>>('/files/search', { q, page }),
    placeholderData: keepPreviousData,
    enabled: q.trim() !== '',
  });
}
