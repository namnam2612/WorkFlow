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
  categoryOfMime,
  FileCategory,
  BLOCKED_EXTENSIONS,
  extensionOf,
  isPreviewableMime,
  looksExecutable,
  mimeFor,
  mimesOfCategory,
  sanitizeFileName,
  matchesPreviewSignature,
} from './file-types';
import { StorageService } from './storage.service';

export const DEFAULT_MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

export interface IncomingFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const projectRefSelect = { id: true, name: true, createdById: true } satisfies Prisma.ProjectSelect;

const attachmentInclude = {
  uploader: { select: USER_BRIEF_SELECT },
  task: { select: { id: true, title: true, status: true, project: { select: projectRefSelect } } },
  project: { select: projectRefSelect },
} satisfies Prisma.AttachmentInclude;

type AttachmentRow = Prisma.AttachmentGetPayload<{ include: typeof attachmentInclude }>;

/** Số file theo loại; `file` = mọi thứ không phải ảnh */
export type AttachmentCounts = Record<FileCategory | 'all' | 'file', number>;

/** Nơi file được đính vào: đúng MỘT trong hai (taskId xor projectId) */
interface AttachmentOwner {
  taskId: number | null;
  projectId: number | null;
}

export type AttachmentPage = Paginated<ReturnType<AttachmentsService['toView']>> & { counts: AttachmentCounts };

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

  async listForProject(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    const rows = await this.prisma.attachment.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: attachmentInclude,
    });
    return rows.map((row) => this.toView(user, row));
  }

  /**
   * Kho tài liệu: mọi file (của dự án lẫn của công việc) thuộc các dự án người dùng được xem.
   * Kèm `counts` theo loại (áp dụng cùng bộ lọc, trừ bộ lọc loại) để hiển thị số trên các tab Ảnh / Tài liệu.
   */
  async list(user: AuthUser, query: ListAttachmentsQueryDto): Promise<AttachmentPage> {
    const visible = this.access.visibleProjectWhere(user);
    const base: Prisma.AttachmentWhereInput[] = [{ OR: [{ task: { project: visible } }, { project: visible }] }];
    if (query.search) base.push({ originalName: { contains: query.search } });
    if (query.projectId !== undefined) base.push({ OR: [{ projectId: query.projectId }, { task: { projectId: query.projectId } }] });
    if (query.source === 'project') base.push({ projectId: { not: null } });
    else if (query.source === 'task') base.push({ taskId: { not: null } });
    if (query.uploaderId !== undefined) base.push({ uploaderId: query.uploaderId });
    if (query.from || query.to) base.push({ createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } });
    const filters = [...base];
    if (query.type === 'other') filters.push({ mimeType: { notIn: allKnownNonOtherMimes() } });
    else if (query.type === 'file') filters.push({ mimeType: { notIn: mimesOfCategory('image') } });
    else if (query.type) filters.push({ mimeType: { in: mimesOfCategory(query.type) } });
    const where: Prisma.AttachmentWhereInput = { AND: filters };

    const sortField = query.sortBy === 'name' ? 'originalName' : query.sortBy;
    const [rows, total, grouped] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        orderBy: [{ [sortField]: query.order }, { id: query.order }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: attachmentInclude,
      }),
      this.prisma.attachment.count({ where }),
      this.prisma.attachment.groupBy({ by: ['mimeType'], where: { AND: base }, _count: { _all: true } }),
    ]);
    return {
      ...toPaginated(
        rows.map((row) => this.toView(user, row)),
        total,
        query.page,
        query.pageSize,
      ),
      counts: this.countByType(grouped),
    };
  }

  private countByType(grouped: { mimeType: string; _count: { _all: number } }[]): AttachmentCounts {
    const counts: AttachmentCounts = { all: 0, file: 0, image: 0, pdf: 0, document: 0, spreadsheet: 0, other: 0 };
    for (const group of grouped) {
      const n = group._count._all;
      const category = categoryOfMime(group.mimeType);
      counts.all += n;
      counts[category] += n;
      if (category !== 'image') counts.file += n;
    }
    return counts;
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
      head = await this.storage.readHead(row.path, 512);
    } catch {
      throw new NotFoundException('File không còn trên máy chủ');
    }
    if (!matchesPreviewSignature(row.mimeType, head)) throw new BadRequestException('Nội dung file không khớp định dạng, hãy tải về');
    return { stream: await this.openStream(row), name: row.originalName, mime: row.mimeType, size: row.size };
  }

  // -------------------------------------------------------------- mutations

  /** Mọi thành viên dự án được đính file vào công việc */
  async uploadToTask(user: AuthUser, taskId: number, files: IncomingFile[] | undefined) {
    const task = await this.findTaskOrThrow(taskId);
    await this.access.assertCanView(user, task.projectId);
    return this.store(user, { taskId, projectId: null }, task.projectId, files);
  }

  /** Chỉ trưởng nhóm của dự án / quản trị viên được đính file vào dự án */
  async uploadToProject(user: AuthUser, projectId: number, files: IncomingFile[] | undefined) {
    await this.access.assertCanManage(user, projectId);
    return this.store(user, { taskId: null, projectId }, projectId, files);
  }

  /** Lưu cả lô: kiểm tra hết trước khi ghi, lỗi giữa chừng thì dọn file đã ghi */
  private async store(user: AuthUser, owner: AttachmentOwner, projectId: number, files: IncomingFile[] | undefined) {
    if ((owner.taskId === null) === (owner.projectId === null)) {
      throw new BadRequestException('File phải thuộc về đúng một công việc hoặc một dự án');
    }
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
              taskId: owner.taskId,
              projectId: owner.projectId,
              uploaderId: user.id,
              originalName: item.name,
              storedName: item.storedName ?? '',
              mimeType: item.mime,
              size: item.buffer.length,
              path: item.path ?? '',
            },
            include: attachmentInclude,
          });
          // Lịch sử hoạt động gắn với công việc; file của dự án không có dòng lịch sử
          if (owner.taskId !== null) {
            await this.activity.log(
              { taskId: owner.taskId, userId: user.id, action: 'attachment_added', detail: { attachmentId: row.id, name: row.originalName, size: row.size } },
              tx,
            );
          }
          created.push(row);
        }
        return created;
      });
      if (owner.taskId !== null) this.realtime.taskChanged(projectId, owner.taskId);
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
    const project = this.projectOf(row);
    await this.access.assertCanView(user, project.id);
    if (!this.canDelete(user, row)) throw new ForbiddenException('Chỉ người gửi, trưởng nhóm của dự án hoặc quản trị viên mới được xóa file');

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      if (row.taskId !== null) {
        await this.activity.log({ taskId: row.taskId, userId: user.id, action: 'attachment_removed', detail: { name: row.originalName } }, tx);
      }
    });
    await this.storage.delete(row.path);
    if (row.taskId !== null) this.realtime.taskChanged(project.id, row.taskId);
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

  /** Dự án chứa file: trực tiếp (file dự án) hoặc qua công việc */
  private projectOf(row: AttachmentRow): { id: number; name: string; createdById: number } {
    const project = row.project ?? row.task?.project;
    if (!project) throw new NotFoundException('File không thuộc dự án hay công việc nào');
    return project;
  }

  private canDelete(user: AuthUser, row: AttachmentRow): boolean {
    return row.uploaderId === user.id || this.access.canManage(user, this.projectOf(row));
  }

  private toView(user: AuthUser, row: AttachmentRow) {
    const project = this.projectOf(row);
    return {
      id: row.id,
      /** 'project' = đính vào dự án, 'task' = đính vào công việc */
      source: row.taskId === null ? ('project' as const) : ('task' as const),
      taskId: row.taskId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
      uploader: row.uploader,
      task: row.task ? { id: row.task.id, title: row.task.title, status: row.task.status } : null,
      project: { id: project.id, name: project.name },
      previewable: isPreviewableMime(row.mimeType),
      canDelete: this.canDelete(user, row),
    };
  }

  private async findViewableOrThrow(user: AuthUser, id: number): Promise<AttachmentRow> {
    const row = await this.prisma.attachment.findUnique({ where: { id }, include: attachmentInclude });
    if (!row) throw new NotFoundException('Không tìm thấy file');
    await this.access.assertCanView(user, this.projectOf(row).id);
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
