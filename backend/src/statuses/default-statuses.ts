import { Prisma, StatusCategory, StatusScope, TaskType } from '@prisma/client';

export interface DefaultStatus {
  /** Khóa ổn định (seed/test dùng); không lưu trong DB */
  key: string;
  name: string;
  color: string;
  category: StatusCategory;
}

/** Bộ trạng thái mặc định của công việc: giống 5 trạng thái cố định trước đây */
export const DEFAULT_TASK_STATUSES: readonly DefaultStatus[] = [
  { key: 'todo', name: 'Cần làm', color: '#64748b', category: 'todo' },
  { key: 'in_progress', name: 'Đang làm', color: '#3b82f6', category: 'in_progress' },
  { key: 'review', name: 'Chờ duyệt', color: '#f59e0b', category: 'in_progress' },
  { key: 'done', name: 'Hoàn thành', color: '#10b981', category: 'done' },
  { key: 'blocked', name: 'Bị chặn', color: '#ef4444', category: 'in_progress' },
];

/** Vòng đời riêng của Bug */
export const DEFAULT_BUG_STATUSES: readonly DefaultStatus[] = [
  { key: 'new', name: 'Mới', color: '#64748b', category: 'todo' },
  { key: 'confirmed', name: 'Đã xác nhận', color: '#f59e0b', category: 'todo' },
  { key: 'fixing', name: 'Đang sửa', color: '#3b82f6', category: 'in_progress' },
  { key: 'verifying', name: 'Chờ kiểm thử', color: '#8b5cf6', category: 'in_progress' },
  { key: 'reopened', name: 'Mở lại', color: '#ef4444', category: 'in_progress' },
  { key: 'closed', name: 'Đã đóng', color: '#10b981', category: 'done' },
];

/** Bug dùng bộ trạng thái Bug; mọi loại khác (task, story, epic) dùng bộ trạng thái công việc */
export const scopeOfType = (type: TaskType): StatusScope => (type === 'bug' ? 'bug' : 'task');

/** Tạo hai bộ trạng thái mặc định cho một dự án mới (chạy chung transaction với việc tạo dự án) */
export async function createDefaultStatuses(tx: Prisma.TransactionClient, projectId: number): Promise<void> {
  const rows = (scope: StatusScope, list: readonly DefaultStatus[]) =>
    list.map((s, position) => ({ projectId, scope, name: s.name, color: s.color, category: s.category, position }));
  await tx.projectStatus.createMany({ data: [...rows('task', DEFAULT_TASK_STATUSES), ...rows('bug', DEFAULT_BUG_STATUSES)] });
}
