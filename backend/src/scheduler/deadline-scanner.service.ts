import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NewNotification, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
/** Báo "sắp đến hạn" khi còn <= 24 giờ */
const DUE_SOON_WINDOW_MS = 24 * HOUR_MS;

export interface ScanResult {
  dueSoon: number;
  overdue: number;
}

@Injectable()
export class DeadlineScannerService {
  private readonly logger = new Logger(DeadlineScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    try {
      const result = await this.scan();
      this.logger.log(`Quét deadline: ${result.dueSoon} sắp đến hạn, ${result.overdue} quá hạn (thông báo mới)`);
    } catch (error) {
      this.logger.error('Quét deadline thất bại', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Tạo thông báo cho task sắp đến hạn (trong 24h) và task quá hạn.
   * Không tạo trùng: mỗi (người nhận, loại, task) chỉ báo một lần cho mỗi mốc deadline.
   */
  async scan(now: Date = new Date()): Promise<ScanResult> {
    const soonLimit = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
    const candidates = await this.prisma.task.findMany({
      where: { status: { category: { not: 'done' } }, deadline: { not: null, lte: soonLimit } },
      select: {
        id: true,
        title: true,
        deadline: true,
        assignees: { select: { userId: true } },
        project: { select: { createdById: true } },
      },
    });

    let dueSoon = 0;
    let overdue = 0;
    for (const task of candidates) {
      if (!task.deadline) continue;
      const isOverdue = task.deadline.getTime() < now.getTime();
      const type = isOverdue ? 'task_overdue' : 'deadline_soon';
      const link = `/tasks/${task.id}`;
      const recipients = new Set<number>();
      for (const assignee of task.assignees) recipients.add(assignee.userId);
      // Task quá hạn: báo thêm cho trưởng nhóm dự án
      if (isOverdue) recipients.add(task.project.createdById);

      // Chỉ tính thông báo được tạo từ (deadline - 24h) trở đi, tức thuộc mốc deadline hiện tại
      const since = new Date(task.deadline.getTime() - DUE_SOON_WINDOW_MS);
      const pending: NewNotification[] = [];
      for (const userId of recipients) {
        const existing = await this.prisma.notification.findFirst({
          where: { userId, type, link, createdAt: { gte: isOverdue ? task.deadline : since } },
          select: { id: true },
        });
        if (existing) continue;
        pending.push({
          userId,
          type,
          link,
          message: isOverdue ? `Công việc "${task.title}" đã quá hạn` : `Công việc "${task.title}" sắp đến hạn trong vòng 24 giờ`,
        });
      }
      if (pending.length === 0) continue;
      await this.notifications.notify(pending);
      if (isOverdue) overdue += pending.length;
      else dueSoon += pending.length;
    }
    return { dueSoon, overdue };
  }
}
