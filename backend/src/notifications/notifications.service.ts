import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { Subject } from 'rxjs';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface NewNotification {
  userId: number;
  type: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  /** Phát mỗi thông báo mới được lưu — gateway Socket.IO đăng ký lắng nghe để đẩy realtime */
  readonly created$ = new Subject<Notification>();

  constructor(private readonly prisma: PrismaService) {}

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
