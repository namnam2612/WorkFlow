import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SocketIoAdapter } from './realtime/socket-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Sau reverse proxy (nginx): tin X-Forwarded-For để rate limit theo IP client thật, không phải IP proxy
  const trustProxy = config.get<number>('TRUST_PROXY') ?? 0;
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`API đang chạy tại http://localhost:${port}/api`);
}

void bootstrap();
