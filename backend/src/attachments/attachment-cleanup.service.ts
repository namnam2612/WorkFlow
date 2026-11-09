import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { projectFolder, taskFolder } from './file-layout';
import { StorageService } from './storage.service';

/** Những gì cần xóa trên ổ đĩa: từng file (theo cột path, gồm cả file còn ở cấu trúc cũ) và thư mục của task/dự án */
export interface CleanupTargets {
  files: string[];
  dirs: string[];
}

/**
 * Dọn file trên ổ đĩa khi task/dự án bị xóa: DB cascade chỉ xóa bản ghi Attachment nên phải gom đường dẫn
 * TRƯỚC khi xóa rồi xóa file + thư mục SAU khi xóa thành công. Tách riêng để Tasks/Projects dùng mà không phụ thuộc vòng.
 */
@Injectable()
export class AttachmentCleanupService {
  private readonly logger = new Logger(AttachmentCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** File và thư mục của task cùng các công việc con của nó */
  async collectTaskTargets(taskId: number): Promise<CleanupTargets> {
    const [files, tasks] = await Promise.all([
      this.prisma.attachment.findMany({ where: { OR: [{ taskId }, { task: { parentId: taskId } }] }, select: { path: true } }),
      this.prisma.task.findMany({ where: { OR: [{ id: taskId }, { parentId: taskId }] }, select: { id: true, projectId: true } }),
    ]);
    return { files: files.map((r) => r.path), dirs: tasks.map((t) => taskFolder(t.projectId, t.id)) };
  }

  /** File và thư mục của dự án (gồm toàn bộ thư mục task bên trong) */
  async collectProjectTargets(projectId: number): Promise<CleanupTargets> {
    const files = await this.prisma.attachment.findMany({ where: { OR: [{ projectId }, { task: { projectId } }] }, select: { path: true } });
    return { files: files.map((r) => r.path), dirs: [projectFolder(projectId)] };
  }

  /** Lỗi xóa chỉ ghi log (StorageService đã nuốt lỗi), không làm hỏng thao tác chính */
  async cleanup(targets: CleanupTargets): Promise<void> {
    await Promise.all(targets.files.map((p) => this.storage.delete(p)));
    await Promise.all(targets.dirs.map((d) => this.storage.deleteDirectory(d)));
    if (targets.files.length > 0 || targets.dirs.length > 0) this.logger.log(`Đã dọn ${targets.files.length} file, ${targets.dirs.length} thư mục của dữ liệu bị xóa`);
  }
}
