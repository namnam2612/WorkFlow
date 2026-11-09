import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';

const commentInclude = { user: { select: USER_BRIEF_SELECT } } as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(user: AuthUser, taskId: number) {
    const task = await this.findTaskOrThrow(taskId);
    await this.access.assertCanView(user, task.projectId);
    return this.prisma.comment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: commentInclude,
    });
  }

  async create(user: AuthUser, taskId: number, content: string) {
    const task = await this.findTaskOrThrow(taskId);
    const project = await this.access.assertCanView(user, task.projectId);
    // Leader/admin bình luận mọi task. Member: task được giao cho mình; với công việc con thì thêm
    // người tạo việc con và người được giao task cha (vì họ chịu trách nhiệm phần việc đó)
    const assigneeIds = task.assignees.map((a) => a.userId);
    const isOwnSubtask = task.parentId !== null && (task.creatorId === user.id || (task.parent?.assignees ?? []).some((a) => a.userId === user.id));
    if (!this.access.canManage(user, project) && !assigneeIds.includes(user.id) && !isOwnSubtask) {
      throw new ForbiddenException('Bạn chỉ được bình luận trên công việc được giao cho mình hoặc công việc con bạn phụ trách');
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({ data: { taskId, userId: user.id, content }, include: commentInclude });
      await this.activity.log(
        { taskId, userId: user.id, action: 'comment_added', detail: { commentId: created.id, excerpt: content.slice(0, 120) } },
        tx,
      );
      return created;
    });

    // Báo cho TẤT CẢ người được giao, người tạo task và trưởng nhóm (trừ người bình luận)
    const recipients = new Set<number>([task.creatorId, project.createdById, ...assigneeIds]);
    recipients.delete(user.id);
    await this.notifications.notify(
      [...recipients].map((userId) => ({
        userId,
        type: 'comment_added',
        message: `${user.name} đã bình luận trong "${task.title}"`,
        link: `/tasks/${task.id}`,
      })),
    );
    this.realtime.taskChanged(task.projectId, task.id);
    return comment;
  }

  async remove(user: AuthUser, commentId: number): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId }, include: { task: true } });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');
    const project = await this.access.assertCanView(user, comment.task.projectId);
    if (comment.userId !== user.id && !this.access.canManage(user, project)) {
      throw new ForbiddenException('Bạn chỉ được xóa bình luận của chính mình');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    this.realtime.taskChanged(comment.task.projectId, comment.taskId);
  }

  private async findTaskOrThrow(taskId: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { assignees: { select: { userId: true } }, parent: { select: { assignees: { select: { userId: true } } } } },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }
}
