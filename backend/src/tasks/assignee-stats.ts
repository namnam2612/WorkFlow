import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AssigneeStat {
  counts: Record<TaskStatus, number>;
  /** Chưa xong và đã quá deadline */
  overdue: number;
}

const STATUS_KEYS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];

export const emptyAssigneeCounts = (): Record<TaskStatus, number> => Object.fromEntries(STATUS_KEYS.map((s) => [s, 0])) as Record<TaskStatus, number>;

/**
 * Thống kê task theo TỪNG người được giao (dashboard workload, trang thành viên).
 * Task giao cho nhiều người được tính cho từng người. `where` lọc trên bảng nối TaskAssignee
 * (userId và/hoặc task); chỉ một truy vấn, cộng dồn ở bộ nhớ vì MySQL không groupBy qua quan hệ.
 */
export async function assigneeStats(prisma: PrismaService, where: Prisma.TaskAssigneeWhereInput, now: Date = new Date()): Promise<Map<number, AssigneeStat>> {
  const rows = await prisma.taskAssignee.findMany({ where, select: { userId: true, task: { select: { status: true, deadline: true } } } });
  const result = new Map<number, AssigneeStat>();
  for (const row of rows) {
    let stat = result.get(row.userId);
    if (!stat) {
      stat = { counts: emptyAssigneeCounts(), overdue: 0 };
      result.set(row.userId, stat);
    }
    stat.counts[row.task.status] += 1;
    if (row.task.status !== 'done' && row.task.deadline !== null && row.task.deadline.getTime() < now.getTime()) stat.overdue += 1;
  }
  return result;
}
