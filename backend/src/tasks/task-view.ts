import { Prisma } from '@prisma/client';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { STATUS_SELECT } from '../statuses/status-view';

/** Người được giao, xếp theo thứ tự được giao (ổn định giữa các lần tải) */
export const assigneesInclude = {
  orderBy: [{ assignedAt: 'asc' }, { userId: 'asc' }],
  select: { user: { select: USER_BRIEF_SELECT } },
} satisfies Prisma.Task$assigneesArgs;

export const taskInclude = {
  assignees: assigneesInclude,
  status: { select: STATUS_SELECT },
  sprint: { select: { id: true, name: true, status: true } },
  epic: { select: { id: true, title: true } },
  fixRelease: { select: { id: true, version: true } },
  foundRelease: { select: { id: true, version: true } },
  project: { select: { id: true, name: true } },
  subtasks: { select: { status: { select: { category: true } } } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/** Chuẩn hóa task trả về: `assignees` là danh sách người dùng rút gọn, thêm số subtask/bình luận, bỏ dữ liệu thô */
export function toTaskView(task: TaskWithRelations) {
  const { subtasks, _count, assignees, ...rest } = task;
  return {
    ...rest,
    assignees: assignees.map((a) => a.user),
    subtaskTotal: subtasks.length,
    subtaskDone: subtasks.filter((s) => s.status.category === 'done').length,
    commentCount: _count.comments,
    attachmentCount: _count.attachments,
  };
}
