import { TaskStatus } from '@prisma/client';

export const STATUS_LABEL_VI: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  review: 'Chờ duyệt',
  done: 'Hoàn thành',
  blocked: 'Bị chặn',
};
