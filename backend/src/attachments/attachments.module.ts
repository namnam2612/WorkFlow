import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ProjectsModule } from '../projects/projects.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService, DEFAULT_MAX_UPLOAD_SIZE, MAX_FILES_PER_UPLOAD } from './attachments.service';
import { StorageModule } from './storage.module';

@Module({
  imports: [
    ProjectsModule,
    StorageModule,
    // Giới hạn dung lượng lấy từ MAX_UPLOAD_SIZE; multer giữ file trong RAM rồi giao cho StorageService
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: config.get<number>('MAX_UPLOAD_SIZE') ?? DEFAULT_MAX_UPLOAD_SIZE, files: MAX_FILES_PER_UPLOAD },
      }),
    }),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
