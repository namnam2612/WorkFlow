import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { ActivityService } from '../activity/activity.service';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import {
  allKnownNonOtherMimes,
  BLOCKED_EXTENSIONS,
  extensionOf,
  isPreviewableMime,
  looksExecutable,
  mimeFor,
  mimesOfCategory,
  sanitizeFileName,
  sniffMime,
} from './file-types';
import { StorageService } from './storage.service';

export const DEFAULT_MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

export interface IncomingFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const attachmentInclude = {
  uploader: { select: USER_BRIEF_SELECT },
  task: { select: { id: true, title: true, status: true, project: { select: { id: true, name: true, createdById: true } } } },
} satisfies Prisma.AttachmentInclude;

type AttachmentRow = Prisma.AttachmentGetPayload<{ include: typeof attachmentInclude }>;

@Injectable()
export class AttachmentsService {
  private readonly maxSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxSize = config.get<number>('MAX_UPLOAD_SIZE') ?? DEFAULT_MAX_UPLOAD_SIZE;
  }

  // ---------------------------------------------------------------- queries

  async listForTask(user: AuthUser, taskId: number) {
    const task = await this.findTaskOrThrow(taskId);
    await this.access.assertCanView(user, task.projectId);
    const rows = await this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: attachmentInclude,
    });
    return rows.map((row) => this.toView(user, row));
  }

  /** Kho tài liệu: mọi file thuộc các dự án người dùng được xem */
  async list(user: AuthUser, query: ListAttachmentsQueryDto): Promise<Paginated<ReturnType<AttachmentsService['toView']>>> {
    const filters: Prisma.AttachmentWhereInput[] = [{ task: { project: this.access.visibleProjectWhere(user) } }];
    if (query.search) filters.push({ originalName: { contains: query.search } });
    if (query.projectId !== undefined) filters.push({ task: { projectId: query.projectId } });
    if (query.uploaderId !== undefined) filters.push({ uploaderId: query.uploaderId });
    if (query.type === 'other') filters.push({ mimeType: { notIn: allKnownNonOtherMimes() } });
    else if (query.type) filters.push({ mimeType: { in: mimesOfCategory(query.type) } });
    if (query.from || query.to) filters.push({ createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } });
    const where: Prisma.AttachmentWhereInput = { AND: filters };

    const sortField = query.sortBy === 'name' ? 'originalName' : query.sortBy;
    const [rows, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        orderBy: [{ [sortField]: query.order }, { id: query.order }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: attachmentInclude,
      }),
      this.prisma.attachment.count({ where }),
    ]);
    return toPaginated(
      rows.map((row) => this.toView(user, row)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Mở luồng tải về. Trả về cả metadata để controller đặt header. */
  async openDownload(user: AuthUser, id: number): Promise<{ stream: Readable; name: string; mime: string; size: number }> {
    const row = await this.findViewableOrThrow(user, id);
    return { stream: await this.openStream(row), name: row.originalName, mime: row.mimeType, size: row.size };
  }

  /** Xem trực tiếp: chỉ ảnh raster và PDF, và chữ ký file phải khớp loại khai báo */
  async openPreview(user: AuthUser, id: number): Promise<{ stream: Readable; name: string; mime: string; size: number }> {
    const row = await this.findViewableOrThrow(user, id);
    if (!isPreviewableMime(row.mimeType)) throw new BadRequestException('Loại file này không hỗ trợ xem trực tiếp, hãy tải về');
    let head: Buffer;
    try {
      head = await this.storage.readHead(row.path, 16);
    } catch {
      throw new NotFoundException('File không còn trên máy chủ');
    }
    if (sniffMime(head) !== row.mimeType) throw new BadRequestException('Nội dung file không khớp định dạng, hãy tải về');
    return { stream: await this.openStream(row), name: row.originalName, mime: row.mimeType, size: row.size };
  }

  // -------------------------------------------------------------- mutations

  async upload(user: AuthUser, taskId: number, files: IncomingFile[] | undefined) {
    const task = await this.findTaskOrThrow(taskId);
    await this.access.assertCanView(user, task.projectId); // mọi thành viên dự án được tải lên
    if (!files || files.length === 0) throw new BadRequestException('Vui lòng chọn ít nhất một file');
    if (files.length > MAX_FILES_PER_UPLOAD) throw new BadRequestException(`Mỗi lần chỉ tải lên tối đa ${MAX_FILES_PER_UPLOAD} file`);

    // Kiểm tra TOÀN BỘ trước khi lưu để một file xấu không làm lệch cả lô
    const prepared = files.map((file) => this.validate(file));

    const now = new Date();
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const saved: string[] = [];
    try {
      for (const item of prepared) {
        const storedName = `${randomUUID()}${item.ext ? `.${item.ext}` : ''}`;
        const path = `${folder}/${storedName}`;
        await this.storage.save(path, item.buffer);
        saved.push(path);
        item.storedName = storedName;
        item.path = path;
      }
      const rows = await this.prisma.$transaction(async (tx) => {
        const created: AttachmentRow[] = [];
        for (const item of prepared) {
          const row = await tx.attachment.create({
            data: {
              taskId,
              uploaderId: user.id,
              originalName: item.name,
              storedName: item.storedName ?? '',
              mimeType: item.mime,
              size: item.buffer.length,
              path: item.path ?? '',
            },
            include: attachmentInclude,
          });
          await this.activity.log(
            { taskId, userId: user.id, action: 'attachment_added', detail: { attachmentId: row.id, name: row.originalName, size: row.size } },
            tx,
          );
          created.push(row);
        }
        return created;
      });
      this.realtime.taskChanged(task.projectId, taskId);
      return rows.map((row) => this.toView(user, row));
    } catch (error) {
      // Không để lại file mồ côi nếu ghi DB thất bại
      await Promise.all(saved.map((key) => this.storage.delete(key)));
      throw error;
    }
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const row = await this.prisma.attachment.findUnique({ where: { id }, include: attachmentInclude });
    if (!row) throw new NotFoundException('Không tìm thấy file');
    await this.access.assertCanView(user, row.task.project.id);
    if (!this.canDelete(user, row)) throw new ForbiddenException('Chỉ người gửi, trưởng nhóm của dự án hoặc quản trị viên mới được xóa file');

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await this.activity.log({ taskId: row.taskId, userId: user.id, action: 'attachment_removed', detail: { name: row.originalName } }, tx);
    });
    await this.storage.delete(row.path);
    this.realtime.taskChanged(row.task.project.id, row.taskId);
  }

  // ---------------------------------------------------------------- helpers

  private validate(file: IncomingFile): { name: string; ext: string; mime: string; buffer: Buffer; storedName?: string; path?: string } {
    const name = sanitizeFileName(file.originalname);
    if (file.buffer.length === 0) throw new BadRequestException(`File "${name}" rỗng`);
    if (file.buffer.length > this.maxSize) {
      throw new PayloadTooLargeException(`File "${name}" vượt quá ${Math.round(this.maxSize / 1024 / 1024)}MB`);
    }
    const ext = extensionOf(name);
    if (BLOCKED_EXTENSIONS.has(ext) || looksExecutable(file.buffer)) {
      throw new BadRequestException(`Không cho phép đính kèm file thực thi hoặc script ("${name}")`);
    }
    // Loại file do SERVER quyết định theo đuôi, không tin Content-Type client gửi
    return { name, ext, mime: mimeFor(name), buffer: file.buffer };
  }

  private canDelete(user: AuthUser, row: AttachmentRow): boolean {
    return row.uploaderId === user.id || this.access.canManage(user, row.task.project);
  }

  private toView(user: AuthUser, row: AttachmentRow) {
    return {
      id: row.id,
      taskId: row.taskId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
      uploader: row.uploader,
      task: { id: row.task.id, title: row.task.title, status: row.task.status },
      project: { id: row.task.project.id, name: row.task.project.name },
      previewable: isPreviewableMime(row.mimeType),
      canDelete: this.canDelete(user, row),
    };
  }

  private async findViewableOrThrow(user: AuthUser, id: number): Promise<AttachmentRow> {
    const row = await this.prisma.attachment.findUnique({ where: { id }, include: attachmentInclude });
    if (!row) throw new NotFoundException('Không tìm thấy file');
    await this.access.assertCanView(user, row.task.project.id);
    return row;
  }

  private async openStream(row: AttachmentRow): Promise<Readable> {
    try {
      return await this.storage.read(row.path);
    } catch {
      throw new NotFoundException('File không còn trên máy chủ');
    }
  }

  private async findTaskOrThrow(taskId: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true, projectId: true } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }
}
