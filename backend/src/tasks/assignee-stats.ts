import { Prisma, StatusCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CategoryCounts = Record<StatusCategory, number>;

export interface AssigneeStat {
  counts: CategoryCounts;
  /** Chưa xong và đã quá deadline */
  overdue: number;
}

export const emptyCategoryCounts = (): CategoryCounts => ({ todo: 0, in_progress: 0, done: 0 });

/**
 * Thống kê task theo TỪNG người được giao (dashboard workload, trang thành viên), theo NHÓM trạng thái
 * (cần làm / đang làm / đã xong) vì mỗi dự án có bộ trạng thái riêng.
 * Task giao cho nhiều người được tính cho từng người. `where` lọc trên bảng nối TaskAssignee
 * (userId và/hoặc task); chỉ một truy vấn, cộng dồn ở bộ nhớ vì MySQL không groupBy qua quan hệ.
 */
export async function assigneeStats(prisma: PrismaService, where: Prisma.TaskAssigneeWhereInput, now: Date = new Date()): Promise<Map<number, AssigneeStat>> {
  const rows = await prisma.taskAssignee.findMany({ where, select: { userId: true, task: { select: { deadline: true, status: { select: { category: true } } } } } });
  const result = new Map<number, AssigneeStat>();
  for (const row of rows) {
    let stat = result.get(row.userId);
    if (!stat) {
      stat = { counts: emptyCategoryCounts(), overdue: 0 };
      result.set(row.userId, stat);
    }
    const category = row.task.status.category;
    stat.counts[category] += 1;
    if (category !== 'done' && row.task.deadline !== null && row.task.deadline.getTime() < now.getTime()) stat.overdue += 1;
  }
  return result;
}
