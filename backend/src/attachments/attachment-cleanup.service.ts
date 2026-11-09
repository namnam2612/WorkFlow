import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * Dọn file trên ổ đĩa khi task/dự án bị xóa: DB cascade chỉ xóa bản ghi Attachment nên phải gom đường dẫn
 * TRƯỚC khi xóa rồi xóa file SAU khi xóa thành công. Tách riêng để Tasks/Projects dùng mà không phụ thuộc vòng.
 */
@Injectable()
export class AttachmentCleanupService {
  private readonly logger = new Logger(AttachmentCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** File của task và các công việc con của nó */
  async collectTaskFiles(taskId: number): Promise<string[]> {
    const rows = await this.prisma.attachment.findMany({ where: { OR: [{ taskId }, { task: { parentId: taskId } }] }, select: { path: true } });
    return rows.map((r) => r.path);
  }

  /** File của dự án và của mọi công việc trong dự án */
  async collectProjectFiles(projectId: number): Promise<string[]> {
    const rows = await this.prisma.attachment.findMany({ where: { OR: [{ projectId }, { task: { projectId } }] }, select: { path: true } });
    return rows.map((r) => r.path);
  }

  /** Lỗi xóa file chỉ ghi log (StorageService đã nuốt lỗi), không làm hỏng thao tác chính */
  async deleteFiles(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => this.storage.delete(p)));
    if (paths.length > 0) this.logger.log(`Đã dọn ${paths.length} file của dữ liệu bị xóa`);
  }
}
