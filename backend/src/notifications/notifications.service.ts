import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification } from '@prisma/client';
import { Subject } from 'rxjs';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { SlackService } from './slack.service';

export interface NewNotification {
  userId: number;
  type: string;
  message: string;
  link?: string;
  /** Dự án phát sinh sự kiện: nếu dự án có Slack webhook thì tin cũng được đăng vào kênh */
  projectId?: number;
  /** Nội dung dành cho kênh chung (Slack) khi `message` mang tính cá nhân ("Bạn được giao...") */
  channelMessage?: string;
}

@Injectable()
export class NotificationsService {
  /** Phát mỗi thông báo mới được lưu — gateway Socket.IO đăng ký lắng nghe để đẩy realtime */
  readonly created$ = new Subject<Notification>();

  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly slack: SlackService,
    private readonly config: ConfigService,
  ) {}

  /** Tạo thông báo cho nhiều người (bỏ qua trùng userId) */
  async notify(items: NewNotification[]): Promise<void> {
    const unique = new Map<string, NewNotification>();
    for (const item of items) unique.set(`${item.userId}:${item.type}:${item.link ?? ''}:${item.message}`, item);
    for (const item of unique.values()) {
      const saved = await this.prisma.notification.create({
        data: { userId: item.userId, type: item.type, message: item.message, link: item.link ?? null },
      });
      this.created$.next(saved);
    }
    // Email/Slack gửi nền: chậm hoặc lỗi cũng không làm chậm/hỏng thao tác của người dùng
    void this.dispatchExternal([...unique.values()]).catch((error: unknown) => this.logger.warn(`Gửi kênh ngoài thất bại: ${String(error)}`));
  }

  /** Địa chỉ tuyệt đối của một đường dẫn trong ứng dụng (cho email/Slack) */
  private absoluteLink(link?: string): string {
    const base = (this.config.get<string>('APP_URL') ?? '').replace(/\/+$/, '');
    return link ? `${base}${link}` : base;
  }

  /** Email cho người đã bật nhận email, Slack cho kênh của dự án (mỗi tin chỉ đăng một lần dù nhiều người nhận) */
  async dispatchExternal(items: NewNotification[]): Promise<void> {
    if (items.length === 0) return;
    const tasks: Promise<unknown>[] = [];

    if (this.mail.isConfigured()) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...new Set(items.map((i) => i.userId))] }, emailNotifications: true, isActive: true },
        select: { id: true, email: true },
      });
      const emailOf = new Map(users.map((u) => [u.id, u.email]));
      for (const item of items) {
        const to = emailOf.get(item.userId);
        if (!to) continue;
        const url = this.absoluteLink(item.link);
        tasks.push(this.mail.send({ to, subject: `[TaskFlow] ${item.message}`, text: url ? `${item.message}\n\n${url}` : item.message }));
      }
    }

    const projectIds = [...new Set(items.map((i) => i.projectId).filter((id): id is number => id !== undefined))];
    if (projectIds.length > 0) {
      const projects = await this.prisma.project.findMany({ where: { id: { in: projectIds }, slackWebhookUrl: { not: null } }, select: { id: true, name: true, slackWebhookUrl: true } });
      for (const project of projects) {
        if (!project.slackWebhookUrl) continue;
        const posted = new Set<string>();
        for (const item of items.filter((i) => i.projectId === project.id)) {
          const text = item.channelMessage ?? item.message;
          if (posted.has(text)) continue;
          posted.add(text);
          const url = this.absoluteLink(item.link);
          tasks.push(this.slack.post(project.slackWebhookUrl, `*${project.name}* · ${text}${url ? `\n${url}` : ''}`));
        }
      }
    }
    await Promise.allSettled(tasks);
  }

  async list(userId: number, page: number, pageSize: number, unreadOnly: boolean): Promise<Paginated<Notification>> {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return toPaginated(items, total, page, pageSize);
  }

  unreadCount(userId: number): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: number, id: number): Promise<Notification> {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Không tìm thấy thông báo');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: number): Promise<number> {
    const result = await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return result.count;
  }
}
