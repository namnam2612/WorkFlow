import { Prisma } from '@prisma/client';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';

export const taskInclude = {
  assignee: { select: USER_BRIEF_SELECT },
  project: { select: { id: true, name: true } },
  subtasks: { select: { status: true } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/** Chuẩn hóa task trả về: thêm số subtask/bình luận, bỏ dữ liệu thô */
export function toTaskView(task: TaskWithRelations) {
  const { subtasks, _count, ...rest } = task;
  return {
    ...rest,
    subtaskTotal: subtasks.length,
    subtaskDone: subtasks.filter((s) => s.status === 'done').length,
    commentCount: _count.comments,
    attachmentCount: _count.attachments,
  };
}

