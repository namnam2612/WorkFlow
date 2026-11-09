import { Injectable } from '@nestjs/common';
import { ActivityLog, Prisma } from '@prisma/client';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { PrismaService } from '../prisma/prisma.service';

export type ActivityAction =
  | 'task_created'
  | 'status_changed'
  | 'type_changed'
  | 'story_points_changed'
  | 'bug_info_changed'
  | 'sprint_changed'
  | 'epic_changed'
  | 'worklog_added'
  | 'worklog_removed'
  | 'assignee_changed'
  | 'priority_changed'
  | 'deadline_changed'
  | 'title_changed'
  | 'description_changed'
  | 'hours_changed'
  | 'comment_added'
  | 'subtask_added'
  | 'attachment_added'
  | 'attachment_removed';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ghi một dòng lịch sử; truyền `tx` để ghi cùng transaction với thay đổi dữ liệu */
  log(
    params: { taskId: number; userId: number; action: ActivityAction; detail?: Prisma.InputJsonValue },
    tx?: Db,
  ): Promise<ActivityLog> {
    const db = tx ?? this.prisma;
    return db.activityLog.create({
      data: { taskId: params.taskId, userId: params.userId, action: params.action, detail: params.detail ?? Prisma.JsonNull },
    });
  }

  listForTask(taskId: number): Promise<(ActivityLog & { user: { id: number; name: string; avatarUrl: string | null } })[]> {
    return this.prisma.activityLog.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      include: { user: { select: USER_BRIEF_SELECT } },
    });
  }
}
