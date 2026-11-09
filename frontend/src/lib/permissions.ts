import type { Task, User } from '../types/api';

/** Khớp quy tắc backend: admin hoặc leader là người tạo dự án */
export function canManageProject(user: User | null, project: { createdById: number } | null | undefined): boolean {
  if (!user || !project) return false;
  return user.role === 'admin' || (user.role === 'leader' && project.createdById === user.id);
}

export function isAssignee(user: User | null, task: Pick<Task, 'assigneeId'>): boolean {
  return !!user && task.assigneeId === user.id;
}
