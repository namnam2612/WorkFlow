import { Module } from '@nestjs/common';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';

/** Nơi lưu file. Đổi `useClass` sang lớp S3/MinIO để chuyển kho lưu trữ mà không sửa code khác. */
@Module({
  providers: [{ provide: StorageService, useClass: LocalStorageService }, AttachmentCleanupService],
  exports: [StorageService, AttachmentCleanupService],
})
export class StorageModule {}
