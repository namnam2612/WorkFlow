import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, fetchBlob, uploadFiles } from '../lib/api';
import type { Attachment, AttachmentFilters, AttachmentPage } from '../types/api';
import { invalidateTaskRelated } from './useTasks';

export function useTaskAttachments(taskId: number) {
  return useQuery({ queryKey: ['attachments', 'task', taskId], queryFn: () => api.get<Attachment[]>(`/tasks/${taskId}/attachments`) });
}

/** Kho tài liệu: toàn bộ file trong các dự án người dùng được xem */
export function useAttachmentList(filters: AttachmentFilters) {
  return useQuery({
    queryKey: ['attachments', 'list', filters],
    queryFn: () => api.get<AttachmentPage>('/attachments', { ...filters }),
    placeholderData: keepPreviousData,
  });
}

export function useUploadAttachments(taskId: number) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      setProgress(0);
      try {
        return await uploadFiles<Attachment[]>(`/tasks/${taskId}/attachments`, files, setProgress);
      } finally {
        setProgress(null);
      }
    },
    onSuccess: () => invalidateTaskRelated(queryClient, taskId),
  });
  return { ...mutation, progress };
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachment: Attachment) => api.delete(`/attachments/${attachment.id}`),
    onSuccess: (_data, attachment) => invalidateTaskRelated(queryClient, attachment.taskId),
  });
}

/** Tải file về máy bằng request có xác thực, giữ đúng tên gốc (kể cả tiếng Việt có dấu) */
export async function downloadAttachment(attachment: Attachment): Promise<void> {
  const blob = await fetchBlob(`/attachments/${attachment.id}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Blob URL của bản xem trước (ảnh/PDF); tự giải phóng khi đổi file hoặc đóng */
export function usePreviewUrl(attachmentId: number | null, enabled = true) {
  const [state, setState] = useState<{ id: number; url: string } | { id: number; error: Error } | null>(null);

  useEffect(() => {
    if (attachmentId === null || !enabled) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchBlob(`/attachments/${attachmentId}/preview`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setState({ id: attachmentId, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ id: attachmentId, error: error instanceof Error ? error : new Error('Không xem trước được') });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, enabled]);

  const current = state && state.id === attachmentId ? state : null;
  return {
    url: current && 'url' in current ? current.url : null,
    error: current && 'error' in current ? current.error : null,
    loading: attachmentId !== null && enabled && current === null,
  };
}

/** Tải nội dung bản xem trước (đã xác thực) dưới dạng Blob để tự dựng khung xem ở trình duyệt */
export function usePreviewBlob(attachmentId: number | null, enabled = true) {
  const [state, setState] = useState<{ id: number; blob: Blob } | { id: number; error: Error } | null>(null);

  useEffect(() => {
    if (attachmentId === null || !enabled) return;
    let cancelled = false;
    fetchBlob(`/attachments/${attachmentId}/preview`)
      .then((blob) => {
        if (!cancelled) setState({ id: attachmentId, blob });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ id: attachmentId, error: error instanceof Error ? error : new Error('Không xem trước được') });
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId, enabled]);

  const current = state && state.id === attachmentId ? state : null;
  return {
    blob: current && 'blob' in current ? current.blob : null,
    error: current && 'error' in current ? current.error : null,
    loading: attachmentId !== null && enabled && current === null,
  };
}
