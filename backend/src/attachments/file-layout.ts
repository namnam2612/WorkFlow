/**
 * Cấu trúc thư mục lưu file (khóa lưu = đường dẫn tương đối so với UPLOAD_DIR, cũng là Attachment.path):
 *   projects/{projectId}/{uuid}.{ext}                  file của dự án
 *   projects/{projectId}/tasks/{taskId}/{uuid}.{ext}   file của công việc
 * Tên file trên ổ đĩa vẫn là UUID (không lộ tên gốc). Thuần hàm, không phụ thuộc Nest/Prisma để dùng cả trong seed và script migrate.
 */
export const projectFolder = (projectId: number): string => `projects/${projectId}`;

export const taskFolder = (projectId: number, taskId: number): string => `projects/${projectId}/tasks/${taskId}`;

export interface FileOwner {
  /** Dự án chứa file (với file của task: dự án của task đó) */
  projectId: number;
  /** null = file của dự án */
  taskId: number | null;
}

export const ownerFolder = (owner: FileOwner): string => (owner.taskId === null ? projectFolder(owner.projectId) : taskFolder(owner.projectId, owner.taskId));

export const storagePath = (owner: FileOwner, storedName: string): string => `${ownerFolder(owner)}/${storedName}`;
