import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService, TaskChangedEvent } from './realtime.service';

const ADMIN_ROOM = 'admins';
const userRoom = (userId: number): string => `user:${userId}`;

/**
 * Socket.IO: client gửi access token trong `auth.token`.
 * - Mỗi user vào phòng riêng `user:<id>` để nhận thông báo.
 * - Admin vào thêm phòng `admins` để nhận sự kiện thay đổi task mọi dự án.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    // Xác thực ngay ở bước handshake: token sai/hết hạn => client nhận connect_error "unauthorized"
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error('unauthorized')));
    });
  }

  onModuleInit(): void {
    this.subscriptions.push(
      this.notifications.created$.subscribe((notification) => {
        this.server.to(userRoom(notification.userId)).emit('notification', notification);
      }),
      this.realtime.taskChanged$.subscribe((event) => {
        void this.broadcastTaskChanged(event);
      }),
    );
  }

  onModuleDestroy(): void {
    for (const subscription of this.subscriptions) subscription.unsubscribe();
  }

  private async authenticate(socket: Socket): Promise<void> {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string') throw new Error('missing token');
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true } });
    if (!user?.isActive) throw new Error('inactive');
    await socket.join(userRoom(user.id));
    if (user.role === 'admin') await socket.join(ADMIN_ROOM);
  }

  private async broadcastTaskChanged(event: TaskChangedEvent): Promise<void> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: event.projectId },
        select: { createdById: true, members: { select: { userId: true } } },
      });
      const rooms = new Set<string>([ADMIN_ROOM]);
      if (project) {
        rooms.add(userRoom(project.createdById));
        for (const member of project.members) rooms.add(userRoom(member.userId));
      }
      this.server.to([...rooms]).emit('task:changed', event);
    } catch (error) {
      this.logger.warn(`Không thể phát sự kiện task:changed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
