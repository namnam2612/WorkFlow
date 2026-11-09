import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { FileListQueryDto, FileSearchQueryDto, FolderQueryDto } from './dto/files-query.dto';
import { FilesService } from './files.service';

const PROJECT = { id: 1, name: 'Dự án A', createdById: 10 };
const admin: AuthUser = { id: 1, email: 'a@x.vn', name: 'Admin', role: 'admin' };
const owner: AuthUser = { id: 10, email: 'l@x.vn', name: 'Leader', role: 'leader' };
const otherLeader: AuthUser = { id: 11, email: 'l2@x.vn', name: 'Leader khác', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'Thành viên', role: 'member' };
const outsider: AuthUser = { id: 30, email: 'o@x.vn', name: 'Người ngoài', role: 'member' };
const MEMBER_IDS = new Set([10, 20]);

const folderQuery = (over: Partial<FolderQueryDto> = {}): FolderQueryDto => Object.assign(new FolderQueryDto(), over);
const fileQuery = (over: Partial<FileListQueryDto> = {}): FileListQueryDto => Object.assign(new FileListQueryDto(), over);
const searchQuery = (q: string): FileSearchQueryDto => Object.assign(new FileSearchQueryDto(), { q });

const d = (iso: string) => new Date(iso);

describe('FilesService - kho tài liệu dạng thư mục', () => {
  let prisma: PrismaMock;
  let attachments: { visibleWhere: jest.Mock; toView: jest.Mock };
  let service: FilesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockImplementation(({ where }: { where: { projectId_userId: { userId: number } } }) =>
      Promise.resolve(MEMBER_IDS.has(where.projectId_userId.userId) ? { projectId: 1, userId: where.projectId_userId.userId } : null),
    );
    attachments = {
      visibleWhere: jest.fn().mockReturnValue({ visible: true }),
      toView: jest.fn().mockImplementation((_user: AuthUser, row: { id: number }) => ({ id: row.id })),
    };
    const prismaService = asPrisma(prisma);
    service = new FilesService(prismaService, new ProjectAccessService(prismaService), attachments as unknown as AttachmentsService);
  });

  describe('cấp 1 - danh sách dự án', () => {
    beforeEach(() => {
      prisma.project.findMany.mockResolvedValue([
        { id: 1, name: 'Website', createdById: 10 },
        { id: 2, name: 'Ứng dụng di động', createdById: 10 },
        { id: 3, name: 'Báo cáo', createdById: 10 },
      ]);
      // truy vấn gộp trả số liệu dạng BigInt như MySQL; dự án 3 chưa có file
      prisma.$queryRaw.mockResolvedValue([
        { id: 1, fileCount: BigInt(12), totalSize: BigInt(35_000_000), latestAt: d('2026-11-05T00:00:00Z') },
        { id: 2, fileCount: BigInt(3), totalSize: BigInt(2048), latestAt: d('2026-11-08T00:00:00Z') },
      ]);
    });

    it('chỉ truy vấn các dự án người dùng được xem (member), admin thấy tất cả', async () => {
      await service.listProjects(member, folderQuery());
      expect((callArg(prisma.project.findMany) as { where: { AND: unknown[] } }).where.AND[0]).toEqual({
        OR: [{ members: { some: { userId: 20 } } }, { createdById: 20 }],
      });
      prisma.project.findMany.mockClear();
      await service.listProjects(admin, folderQuery());
      expect((callArg(prisma.project.findMany) as { where: { AND: unknown[] } }).where.AND[0]).toEqual({});
    });

    it('số file và dung lượng đúng (BigInt -> số), dự án chưa có file = 0', async () => {
      const result = await service.listProjects(owner, folderQuery());
      expect(result.items.find((p) => p.id === 1)).toMatchObject({ fileCount: 12, totalSize: 35_000_000, latestAt: d('2026-11-05T00:00:00Z') });
      expect(result.items.find((p) => p.id === 3)).toMatchObject({ fileCount: 0, totalSize: 0, latestAt: null });
    });

    it('đếm bằng MỘT truy vấn GROUP BY giới hạn đúng các dự án được xem, không tải file lên', async () => {
      await service.listProjects(owner, folderQuery());
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const sql = callArg(prisma.$queryRaw) as Prisma.Sql;
      expect(sql.sql).toMatch(/GROUP BY/i);
      expect(sql.sql).toMatch(/COUNT\(\*\)/i);
      expect(sql.sql).toMatch(/SUM\(a\.size\)/i);
      expect(sql.values).toEqual([1, 2, 3]);
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('không có dự án nào được xem thì không truy vấn đếm', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      const result = await service.listProjects(outsider, folderQuery());
      expect(result.items).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('sắp xếp theo tên (có dấu tiếng Việt) và theo thời gian cập nhật mới nhất (thư mục trống xếp cuối)', async () => {
      expect((await service.listProjects(owner, folderQuery())).items.map((p) => p.name)).toEqual(['Báo cáo', 'Ứng dụng di động', 'Website']);
      expect((await service.listProjects(owner, folderQuery({ sortBy: 'updatedAt', order: 'desc' }))).items.map((p) => p.id)).toEqual([2, 1, 3]);
      expect((await service.listProjects(owner, folderQuery({ sortBy: 'updatedAt', order: 'asc' }))).items.map((p) => p.id)).toEqual([1, 2, 3]);
    });

    it('tìm theo tên thư mục và phân trang (20 mục/trang mặc định)', async () => {
      await service.listProjects(owner, folderQuery({ search: 'web' }));
      expect((callArg(prisma.project.findMany) as { where: { AND: unknown[] } }).where.AND[1]).toEqual({ name: { contains: 'web' } });
      const many = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: `Dự án ${String(i).padStart(2, '0')}`, createdById: 10 }));
      prisma.project.findMany.mockResolvedValue(many);
      prisma.$queryRaw.mockResolvedValue([]);
      const p2 = await service.listProjects(owner, folderQuery({ page: 3 }));
      expect(p2).toMatchObject({ total: 45, page: 3, pageSize: 20, totalPages: 3 });
      expect(p2.items).toHaveLength(5);
    });
  });

  describe('cấp 2 - trong dự án', () => {
    beforeEach(() => {
      prisma.attachment.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { size: 4096 }, _max: { createdAt: d('2026-11-01T00:00:00Z') } });
      prisma.attachment.groupBy.mockResolvedValue([
        { taskId: 7, _count: { _all: 3 }, _sum: { size: 3000 }, _max: { createdAt: d('2026-11-03T00:00:00Z') } },
        { taskId: 8, _count: { _all: 5 }, _sum: { size: 500 }, _max: { createdAt: d('2026-11-09T00:00:00Z') } },
      ]);
      prisma.task.findMany.mockResolvedValue([
        { id: 7, title: 'Thiết kế', status: 'done', parentId: null, parent: null },
        { id: 8, title: 'Lập trình', status: 'in_progress', parentId: null, parent: null },
      ]);
    });

    it('người ngoài dự án bị chặn; thành viên, leader sở hữu và admin xem được', async () => {
      await expect(service.getProject(outsider, 1, folderQuery())).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.getProject(otherLeader, 1, folderQuery())).rejects.toBeInstanceOf(ForbiddenException);
      for (const user of [member, owner, admin]) await expect(service.getProject(user, 1, folderQuery())).resolves.toBeDefined();
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.getProject(admin, 99, folderQuery())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trả file chung (đếm gộp) và task kèm số file, dung lượng, file mới nhất, trạng thái', async () => {
      const result = await service.getProject(member, 1, folderQuery());
      expect(result.project).toEqual({ id: 1, name: 'Dự án A' });
      expect(result.common).toEqual({ fileCount: 2, totalSize: 4096, latestAt: d('2026-11-01T00:00:00Z') });
      expect(result.items).toEqual([
        { id: 8, name: 'Lập trình', status: 'in_progress', parent: null, fileCount: 5, totalSize: 500, latestAt: d('2026-11-09T00:00:00Z') },
        { id: 7, name: 'Thiết kế', status: 'done', parent: null, fileCount: 3, totalSize: 3000, latestAt: d('2026-11-03T00:00:00Z') },
      ]);
    });

    it('đếm bằng aggregate/groupBy trong DB, giới hạn theo dự án', async () => {
      await service.getProject(member, 1, folderQuery());
      expect(callArg(prisma.attachment.aggregate)).toMatchObject({ where: { projectId: 1 } });
      expect(callArg(prisma.attachment.groupBy)).toMatchObject({ by: ['taskId'], where: { task: { projectId: 1 } } });
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('mặc định chỉ task có file; includeEmpty=true lấy cả task chưa có file (đếm = 0)', async () => {
      await service.getProject(member, 1, folderQuery());
      expect((callArg(prisma.task.findMany) as { where: Record<string, unknown> }).where).toMatchObject({ projectId: 1, id: { in: [7, 8] } });

      prisma.task.findMany.mockClear();
      prisma.task.findMany.mockResolvedValue([
        { id: 7, title: 'Thiết kế', status: 'done', parentId: null, parent: null },
        { id: 9, title: 'Chưa có file', status: 'todo', parentId: null, parent: null },
      ]);
      const result = await service.getProject(member, 1, folderQuery({ includeEmpty: true }));
      const where = (callArg(prisma.task.findMany) as { where: Record<string, unknown> }).where;
      expect(where).toEqual({ projectId: 1 });
      expect(result.items.find((t) => t.id === 9)).toMatchObject({ fileCount: 0, totalSize: 0, latestAt: null });
    });

    it('tìm theo tiêu đề task, sắp xếp theo thời gian cập nhật, phân trang', async () => {
      await service.getProject(member, 1, folderQuery({ search: 'thiết' }));
      expect((callArg(prisma.task.findMany) as { where: Record<string, unknown> }).where).toMatchObject({ title: { contains: 'thiết' } });
      expect((await service.getProject(member, 1, folderQuery({ sortBy: 'updatedAt', order: 'desc' }))).items.map((t) => t.id)).toEqual([8, 7]);
      expect((await service.getProject(member, 1, folderQuery({ sortBy: 'name', order: 'desc' }))).items.map((t) => t.name)).toEqual(['Thiết kế', 'Lập trình']);
      expect(await service.getProject(member, 1, folderQuery({ pageSize: 1, page: 2 }))).toMatchObject({ total: 2, totalPages: 2, items: [{ id: 7 }] });
    });

    it('chỉ leader của dự án và admin được tải lên file chung (canUpload)', async () => {
      expect((await service.getProject(owner, 1, folderQuery())).canUpload).toBe(true);
      expect((await service.getProject(admin, 1, folderQuery())).canUpload).toBe(true);
      expect((await service.getProject(member, 1, folderQuery())).canUpload).toBe(false);
    });
  });

  describe('file chung của dự án', () => {
    beforeEach(() => {
      prisma.attachment.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prisma.attachment.count.mockResolvedValue(2);
    });

    it('người ngoài không xem được danh sách file chung', async () => {
      await expect(service.listProjectFiles(outsider, 1, fileQuery())).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('chỉ lấy file đính trực tiếp vào dự án; hỗ trợ tìm theo tên và sắp xếp', async () => {
      const result = await service.listProjectFiles(member, 1, fileQuery({ search: 'hợp đồng', sortBy: 'name', order: 'asc' }));
      const arg = callArg(prisma.attachment.findMany) as { where: { AND: unknown[] }; orderBy: unknown[] };
      expect(arg.where.AND).toEqual([{ projectId: 1 }, { originalName: { contains: 'hợp đồng' } }]);
      expect(arg.orderBy[0]).toEqual({ originalName: 'asc' });
      expect(result).toMatchObject({ project: { id: 1 }, total: 2, items: [{ id: 1 }, { id: 2 }], canUpload: false });
    });
  });

  describe('cấp 3 - trong task', () => {
    const task = { id: 7, title: 'Thiết kế', status: 'done', projectId: 1, project: { name: 'Dự án A' }, parent: null };
    beforeEach(() => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.attachment.findMany.mockResolvedValue([{ id: 5 }]);
      prisma.attachment.count.mockResolvedValue(1);
    });

    it('người ngoài dự án không vào được task (và không thấy file); task không tồn tại -> 404', async () => {
      await expect(service.getTask(outsider, 7, fileQuery())).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.getTask(otherLeader, 7, fileQuery())).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.getTask(admin, 99, fileQuery())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trả thông tin task (id, title, status, projectId, projectName) và các file của riêng task đó', async () => {
      const result = await service.getTask(member, 7, fileQuery());
      expect(result.task).toEqual({ id: 7, title: 'Thiết kế', status: 'done', projectId: 1, projectName: 'Dự án A', parent: null });
      expect((callArg(prisma.attachment.findMany) as { where: { AND: unknown[] } }).where.AND[0]).toEqual({ taskId: 7 });
      expect(result).toMatchObject({ total: 1, items: [{ id: 5 }], canUpload: true });
    });

    it('sắp xếp theo dung lượng và phân trang theo mặc định 20/trang', async () => {
      await service.getTask(member, 7, fileQuery({ sortBy: 'size', order: 'desc', page: 2 }));
      const arg = callArg(prisma.attachment.findMany) as { orderBy: unknown[]; skip: number; take: number };
      expect(arg).toMatchObject({ skip: 20, take: 20 });
      expect(arg.orderBy[0]).toEqual({ size: 'desc' });
    });
  });

  describe('tìm file trên toàn kho', () => {
    it('chỉ trong các dự án được xem (điều kiện quyền luôn được áp), tìm theo tên file, phân trang', async () => {
      prisma.attachment.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.attachment.count.mockResolvedValue(1);
      const result = await service.search(member, searchQuery('báo cáo'));
      expect(attachments.visibleWhere).toHaveBeenCalledWith(member);
      expect((callArg(prisma.attachment.findMany) as { where: { AND: unknown[] } }).where.AND).toEqual([{ visible: true }, { originalName: { contains: 'báo cáo' } }]);
      expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20, items: [{ id: 1 }] });
    });
  });
});
