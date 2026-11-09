import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

/** Áp cấu hình CORS (từ env) cho Socket.IO */
export class SocketIoAdapter extends IoAdapter {
  private readonly origins: string[];

  constructor(app: INestApplicationContext) {
    super(app);
    const config = app.get(ConfigService);
    this.origins = (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173').split(',').map((o) => o.trim());
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: true } });
  }
}
