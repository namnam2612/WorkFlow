import { BadRequestException, ForbiddenException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { AttachmentsService } from './attachments.service';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { contentDisposition, fixFileNameEncoding, looksExecutable, sanitizeFileName, sniffMime } from './file-types';

const PROJECT = { id: 1, name: 'Dự án A', createdById: 10 };

const admin: AuthUser = { id: 1, email: 'a@x.vn', name: 'Admin', role: 'admin' };
const owner: AuthUser = { id: 10, email: 'l@x.vn', name: 'Trưởng nhóm', role: 'leader' };
const otherLeader: AuthUser = { id: 11, email: 'l2@x.vn', name: 'Leader khác', role: 'leader' };
const uploader: AuthUser = { id: 20, email: 'm1@x.vn', name: 'Người gửi', role: 'member' };
const teammate: AuthUser = { id: 21, email: 'm2@x.vn', name: 'Đồng đội', role: 'member' };
const outsider: AuthUser = { id: 30, email: 'm3@x.vn', name: 'Người ngoài', role: 'member' };

/** Thành viên của PROJECT */
const MEMBER_IDS = new Set([10, 20, 21]);

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(16)]);
const file = (originalname: string, buffer: Buffer = Buffer.from('nội dung')) => ({ originalname, size: buffer.length, buffer });

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    taskId: 7,
    uploaderId: 20,
    originalName: 'bao-cao.pdf',
    storedName: 'uuid.pdf',
    mimeType: 'application/pdf',
    size: 100,
    path: '2026/11/uuid.pdf',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    uploader: { id: 20, name: 'Người gửi', avatarUrl: null },
    task: { id: 7, title: 'Task A', status: 'todo', project: PROJECT },
    ...overrides,
  };
}

describe('AttachmentsService', () => {
  let prisma: PrismaMock;
  let storage: Record<'save' | 'read' | 'readHead' | 'delete', jest.Mock>;
  let activity: { log: jest.Mock };
  let realtime: { taskChanged: jest.Mock };
  let service: AttachmentsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    storage = {
      save: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockImplementation(() => Promise.resolve(Readable.from(['x']))),
      readHead: jest.fn().mockResolvedValue(PDF),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    activity = { log: jest.fn().mockResolvedValue({}) };
    realtime = { taskChanged: jest.fn() };

    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockImplementation(({ where }: { where: { projectId_userId: { userId: number } } }) =>
      Promise.resolve(MEMBER_IDS.has(where.projectId_userId.userId) ? { projectId: 1, userId: where.projectId_userId.userId } : null),
    );
    prisma.task.findUnique.mockResolvedValue({ id: 7, projectId: 1 });
    prisma.attachment.findUnique.mockResolvedValue(row());
    prisma.attachment.findMany.mockResolvedValue([row()]);
    prisma.attachment.count.mockResolvedValue(1);
    prisma.attachment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(row({ id: 6, ...data })));
    prisma.attachment.delete.mockResolvedValue({});

    const prismaService = asPrisma(prisma);
    service = new AttachmentsService(
      prismaService,
      new ProjectAccessService(prismaService),
      activity as unknown as ActivityService,
      realtime as unknown as RealtimeService,
      storage,
      new ConfigService({ MAX_UPLOAD_SIZE: 1024 }),
    );
  });

  describe('phân quyền xem / tải', () => {
    it('người ngoài dự án không xem được danh sách file của task', async () => {
      await expect(service.listForTask(outsider, 7)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('người ngoài dự án không tải về, không xem trước được (dù biết id)', async () => {
      await expect(service.openDownload(outsider, 5)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.openPreview(outsider, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('thành viên dự án, leader sở hữu và admin xem/tải được', async () => {
      for (const user of [teammate, uploader, owner, admin]) {
        await expect(service.openDownload(user, 5)).resolves.toMatchObject({ name: 'bao-cao.pdf', mime: 'application/pdf' });
      }
      await expect(service.listForTask(teammate, 7)).resolves.toHaveLength(1);
    });

    it('404 khi file hoặc task không tồn tại', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);
      await expect(service.openDownload(admin, 404)).rejects.toBeInstanceOf(NotFoundException);
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.listForTask(admin, 404)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 khi bản ghi còn nhưng file đã mất trên ổ đĩa', async () => {
      storage.read.mockRejectedValue(new Error('ENOENT'));
      await expect(service.openDownload(admin, 5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('xem trực tiếp', () => {
    it('cho phép PDF khi chữ ký khớp', async () => {
      await expect(service.openPreview(teammate, 5)).resolves.toMatchObject({ mime: 'application/pdf' });
    });

    it('từ chối loại không xem được (docx, svg...) và file có đuôi giả (nội dung không khớp)', async () => {
      prisma.attachment.findUnique.mockResolvedValue(row({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      await expect(service.openPreview(teammate, 5)).rejects.toBeInstanceOf(BadRequestException);
      prisma.attachment.findUnique.mockResolvedValue(row({ mimeType: 'image/svg+xml' }));
      await expect(service.openPreview(teammate, 5)).rejects.toBeInstanceOf(BadRequestException);
      // khai báo là png nhưng nội dung thật là PDF
      prisma.attachment.findUnique.mockResolvedValue(row({ mimeType: 'image/png' }));
      await expect(service.openPreview(teammate, 5)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('upload', () => {
    it('người ngoài dự án không tải lên được', async () => {
      await expect(service.upload(outsider, 7, [file('a.txt')])).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('mọi thành viên dự án tải lên được; lưu bằng UUID, ghi người gửi và activity log', async () => {
      const result = await service.upload(teammate, 7, [file('Báo cáo tháng 11.pdf', PDF), file('ảnh.png', PNG)]);
      expect(result).toHaveLength(2);
      expect(storage.save).toHaveBeenCalledTimes(2);
      const key = callArg(storage.save, 0, 0) as string;
      expect(key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
      expect(key).not.toContain('Báo cáo');
      expect(callArg(prisma.attachment.create) as { data: Record<string, unknown> }).toMatchObject({
        data: { taskId: 7, uploaderId: 21, originalName: 'Báo cáo tháng 11.pdf', mimeType: 'application/pdf' },
      });
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'attachment_added', userId: 21, taskId: 7 }), expect.anything());
      expect(realtime.taskChanged).toHaveBeenCalledWith(1, 7);
    });

    it.each(['virus.exe', 'run.sh', 'setup.BAT', 'script.js', 'x.ps1'])('chặn file thực thi theo đuôi: %s', async (name) => {
      await expect(service.upload(uploader, 7, [file(name)])).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('chặn file thực thi đổi đuôi (ELF / PE / shebang)', async () => {
      const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(60)]);
      await expect(service.upload(uploader, 7, [file('anh.png', elf)])).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.upload(uploader, 7, [file('ghi-chu.txt', Buffer.from('#!/bin/sh\nrm -rf /'))])).rejects.toBeInstanceOf(BadRequestException);
      const pe = Buffer.alloc(0x80);
      pe.write('MZ', 0);
      pe.writeUInt32LE(0x40, 0x3c);
      pe.write('PE\0\0', 0x40, 'binary');
      await expect(service.upload(uploader, 7, [file('doc.pdf', pe)])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('một file xấu trong lô => từ chối cả lô, chưa lưu file nào', async () => {
      await expect(service.upload(uploader, 7, [file('ok.pdf', PDF), file('bad.exe')])).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('từ chối file quá dung lượng, file rỗng, không có file, quá 10 file', async () => {
      await expect(service.upload(uploader, 7, [file('lon.pdf', Buffer.alloc(2048))])).rejects.toBeInstanceOf(PayloadTooLargeException);
      await expect(service.upload(uploader, 7, [file('rong.txt', Buffer.alloc(0))])).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.upload(uploader, 7, undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.upload(uploader, 7, Array.from({ length: 11 }, (_, i) => file(`f${i}.txt`)))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ghi DB lỗi => xóa các file đã lưu (không để file mồ côi)', async () => {
      prisma.attachment.create.mockRejectedValue(new Error('db down'));
      await expect(service.upload(uploader, 7, [file('a.pdf', PDF)])).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledWith(callArg(storage.save, 0, 0));
    });

    it('loại file do server quyết định theo đuôi, không tin Content-Type client', async () => {
      await service.upload(uploader, 7, [{ ...file('ghi-chu.txt'), mimetype: 'application/x-msdownload' } as never]);
      expect(callArg(prisma.attachment.create) as { data: Record<string, unknown> }).toMatchObject({ data: { mimeType: 'text/plain' } });
    });
  });

  describe('xóa', () => {
    it('người ngoài dự án không xóa được', async () => {
      await expect(service.remove(outsider, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attachment.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('thành viên khác (không phải người gửi) và leader dự án khác không xóa được', async () => {
      await expect(service.remove(teammate, 5)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(otherLeader, 5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attachment.delete).not.toHaveBeenCalled();
    });

    it.each([
      ['người gửi', uploader],
      ['leader của dự án', owner],
      ['admin', admin],
    ])('%s xóa được: xóa bản ghi, file trên ổ đĩa và ghi activity log', async (_name, user) => {
      await service.remove(user, 5);
      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(storage.delete).toHaveBeenCalledWith('2026/11/uuid.pdf');
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'attachment_removed', userId: user.id }), expect.anything());
    });

    it('404 khi file không tồn tại', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);
      await expect(service.remove(admin, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Kho tài liệu (list)', () => {
    const query = (over: Partial<ListAttachmentsQueryDto> = {}): ListAttachmentsQueryDto =>
      Object.assign(new ListAttachmentsQueryDto(), over);
    const whereOf = (): { AND: Record<string, unknown>[] } => (callArg(prisma.attachment.findMany) as { where: { AND: Record<string, unknown>[] } }).where;

    it('luôn giới hạn theo các dự án người dùng được xem (member)', async () => {
      await service.list(uploader, query());
      expect(whereOf().AND[0]).toEqual({
        task: { project: { OR: [{ members: { some: { userId: 20 } } }, { createdById: 20 }] } },
      });
    });

    it('admin xem tất cả (không giới hạn dự án)', async () => {
      await service.list(admin, query());
      expect(whereOf().AND[0]).toEqual({ task: { project: {} } });
    });

    it('lọc theo tên, dự án, người gửi, loại, khoảng ngày; sắp xếp theo tên', async () => {
      await service.list(
        uploader,
        query({ search: 'báo cáo', projectId: 1, uploaderId: 21, type: 'pdf', from: new Date('2026-11-01'), to: new Date('2026-11-30'), sortBy: 'name', order: 'asc' }),
      );
      const and = whereOf().AND;
      expect(and).toEqual(
        expect.arrayContaining([
          { originalName: { contains: 'báo cáo' } },
          { task: { projectId: 1 } },
          { uploaderId: 21 },
          { mimeType: { in: ['application/pdf'] } },
          { createdAt: { gte: new Date('2026-11-01'), lte: new Date('2026-11-30') } },
        ]),
      );
      expect((callArg(prisma.attachment.findMany) as { orderBy: unknown[] }).orderBy[0]).toEqual({ originalName: 'asc' });
    });

    it('loại "other" = mọi mime không thuộc ảnh/PDF/văn bản/bảng tính', async () => {
      await service.list(uploader, query({ type: 'other' }));
      const filter = whereOf().AND.find((f) => 'mimeType' in f) as { mimeType: { notIn: string[] } };
      expect(filter.mimeType.notIn).toEqual(expect.arrayContaining(['image/png', 'application/pdf', 'text/csv']));
    });

    it('mỗi file trả kèm task, dự án, người gửi và quyền xóa của người xem', async () => {
      const result = await service.list(teammate, query());
      expect(result.items[0]).toMatchObject({
        originalName: 'bao-cao.pdf',
        task: { id: 7, title: 'Task A' },
        project: { id: 1, name: 'Dự án A' },
        uploader: { id: 20, name: 'Người gửi' },
        canDelete: false,
        previewable: true,
      });
      expect((await service.list(uploader, query())).items[0].canDelete).toBe(true);
      expect((await service.list(owner, query())).items[0].canDelete).toBe(true);
    });
  });
});

describe('file-types', () => {
  it('sửa tên file tiếng Việt bị vỡ mã (multer giải mã latin1) và giữ nguyên tên đúng', () => {
    const garbled = Buffer.from('Báo cáo tháng 11.pdf', 'utf8').toString('latin1');
    expect(fixFileNameEncoding(garbled)).toBe('Báo cáo tháng 11.pdf');
    expect(fixFileNameEncoding('Báo cáo tháng 11.pdf')).toBe('Báo cáo tháng 11.pdf');
    expect(fixFileNameEncoding('café.txt')).toBe('café.txt');
    expect(fixFileNameEncoding('bao-cao.pdf')).toBe('bao-cao.pdf');
  });

  it('làm sạch tên file: bỏ đường dẫn, ký tự điều khiển, cắt độ dài', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(sanitizeFileName('a\u0000b\nc.txt')).toBe('abc.txt');
    expect(sanitizeFileName('   ')).toBe('tep-khong-ten');
    expect(sanitizeFileName(`${'x'.repeat(300)}.pdf`)).toHaveLength(255);
    expect(sanitizeFileName(`${'x'.repeat(300)}.pdf`).endsWith('.pdf')).toBe(true);
  });

  it('Content-Disposition hỗ trợ tên tiếng Việt và không bị chèn header', () => {
    const header = contentDisposition('attachment', 'Báo cáo "tháng" 11.pdf');
    expect(header).toContain("filename*=UTF-8''B%C3%A1o%20c%C3%A1o%20%22th%C3%A1ng%22%2011.pdf");
    expect(header).not.toMatch(/[^\x20-\x7e]/);
    expect(header.startsWith('attachment; filename="B_o c_o _th_ng_ 11.pdf"')).toBe(true);
  });

  it('nhận diện chữ ký ảnh/PDF và mã thực thi', () => {
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime(PDF)).toBe('application/pdf');
    expect(sniffMime(Buffer.from('<svg>'))).toBeNull();
    expect(looksExecutable(PNG)).toBe(false);
    expect(looksExecutable(Buffer.from('MZ này chỉ là văn bản bình thường'))).toBe(false);
  });
});
