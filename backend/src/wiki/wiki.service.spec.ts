import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { slugify, uniqueSlug, wouldCreateTreeCycle } from './slug';
import { WikiService } from './wiki.service';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'L', role: 'leader' };
const dev: AuthUser = { id: 20, email: 'd@x.vn', name: 'Dev', role: 'member' };
const other: AuthUser = { id: 21, email: 'e@x.vn', name: 'E', role: 'member' };
const outsider: AuthUser = { id: 30, email: 'x@x.vn', name: 'X', role: 'member' };
const T0 = new Date('2026-11-01T00:00:00Z');

describe('slug', () => {
  it('bỏ dấu tiếng Việt, chuẩn hóa, giới hạn độ dài', () => {
    expect(slugify('Hướng dẫn cài đặt API v2!')).toBe('huong-dan-cai-dat-api-v2');
    expect(slugify('  Đường dẫn / Đặc tả  ')).toBe('duong-dan-dac-ta');
    expect(slugify('!!!')).toBe('trang');
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it('tránh trùng bằng hậu tố số', () => {
    expect(uniqueSlug('api', new Set())).toBe('api');
    expect(uniqueSlug('api', new Set(['api', 'api-2']))).toBe('api-3');
  });
  it('phát hiện vòng trong cây trang', () => {
    const parents = new Map<number, number | null>([[1, null], [2, 1], [3, 2]]);
    expect(wouldCreateTreeCycle(parents, 1, 3)).toBe(true); // cha 1 = hậu duệ 3
    expect(wouldCreateTreeCycle(parents, 2, 2)).toBe(true);
    expect(wouldCreateTreeCycle(parents, 3, 1)).toBe(false);
    expect(wouldCreateTreeCycle(parents, 3, null)).toBe(false);
  });
});

describe('WikiService', () => {
  let prisma: PrismaMock;
  let service: WikiService;
  const page = (over: object = {}) => ({ id: 5, projectId: 1, parentId: null, title: 'Cài đặt', slug: 'cai-dat', content: 'v1', position: 0, createdById: 20, updatedById: 20, createdAt: T0, updatedAt: T0, ...over });

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockImplementation(({ where }: { where: { projectId_userId: { userId: number } } }) => Promise.resolve(where.projectId_userId.userId === 30 ? null : { projectId: 1, userId: where.projectId_userId.userId }));
    prisma.wikiPage.findUnique.mockResolvedValue(page());
    prisma.wikiPage.findMany.mockResolvedValue([]);
    prisma.wikiPage.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 9, ...data }));
    prisma.wikiPage.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...page(), ...data }));
    prisma.wikiRevision.create.mockResolvedValue({});
    prisma.wikiRevision.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    service = new WikiService(asPrisma(prisma), new ProjectAccessService(asPrisma(prisma)));
  });

  it('thành viên dự án soạn được; người ngoài không xem/tạo được', async () => {
    await expect(service.tree(outsider, 1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create(outsider, 1, { title: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    await service.create(dev, 1, { title: 'Hướng dẫn mới', content: '# Xin chào' });
    expect(callArg(prisma.wikiPage.create)).toMatchObject({ data: { projectId: 1, slug: 'huong-dan-moi', content: '# Xin chào', createdById: 20, updatedById: 20 } });
  });

  it('slug trùng được thêm hậu tố; trang cha phải cùng dự án', async () => {
    prisma.wikiPage.findMany.mockResolvedValue([{ slug: 'api' }, { slug: 'api-2' }]);
    await service.create(dev, 1, { title: 'API' });
    expect(callArg(prisma.wikiPage.create)).toMatchObject({ data: { slug: 'api-3' } });
    prisma.wikiPage.findUnique.mockResolvedValue({ projectId: 2 });
    await expect(service.create(dev, 1, { title: 'Con', parentId: 4 })).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('update', () => {
    it('sửa nội dung lưu bản cũ vào lịch sử, ghi người sửa mới', async () => {
      await service.update(other, 5, { content: 'v2' });
      expect(callArg(prisma.wikiRevision.create)).toMatchObject({ data: { pageId: 5, title: 'Cài đặt', content: 'v1', authorId: 20 } });
      expect(callArg(prisma.wikiPage.update)).toMatchObject({ data: { content: 'v2', updatedById: 21 } });
    });

    it('không đổi gì thì không tạo bản lưu', async () => {
      await service.update(other, 5, { content: 'v1', title: 'Cài đặt' });
      expect(prisma.wikiRevision.create).not.toHaveBeenCalled();
    });

    it('xung đột chỉnh sửa: updatedAt đã đổi => 409 và không ghi đè', async () => {
      await expect(service.update(other, 5, { content: 'v2', expectedUpdatedAt: '2026-10-31T00:00:00Z' })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.wikiPage.update).not.toHaveBeenCalled();
      await expect(service.update(other, 5, { content: 'v2', expectedUpdatedAt: T0.toISOString() })).resolves.toBeDefined();
    });

    it('chặn chuyển trang vào chính nó hoặc hậu duệ; xóa bớt bản lưu cũ quá giới hạn', async () => {
      prisma.wikiPage.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(where.id === 5 ? page() : { projectId: 1 }));
      prisma.wikiPage.findMany.mockResolvedValue([{ id: 5, parentId: null }, { id: 6, parentId: 5 }]);
      await expect(service.update(dev, 5, { parentId: 6 })).rejects.toThrow(/chính nó/);
      prisma.wikiRevision.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      (prisma.wikiRevision as unknown as Record<string, jest.Mock>).deleteMany.mockResolvedValue({});
      await service.update(dev, 5, { content: 'mới' });
      expect(callArg(prisma.wikiRevision.deleteMany)).toMatchObject({ where: { id: { in: [1, 2] } } });
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.wikiPage.updateMany.mockResolvedValue({ count: 2 });
      prisma.wikiPage.delete.mockResolvedValue({});
    });

    it('người tạo hoặc leader xóa được; người khác không; trang con được nâng lên cấp cha', async () => {
      await expect(service.remove(other, 5)).rejects.toBeInstanceOf(ForbiddenException);
      prisma.wikiPage.findUnique.mockResolvedValue(page({ parentId: 3 }));
      await service.remove(dev, 5);
      expect(callArg(prisma.wikiPage.updateMany)).toMatchObject({ where: { parentId: 5 }, data: { parentId: 3 } });
      await expect(service.remove(owner, 5)).resolves.toBeUndefined();
    });
  });

  describe('lịch sử', () => {
    it('khôi phục bản cũ: nội dung hiện tại được lưu lại trước khi ghi đè; bản của trang khác bị từ chối', async () => {
      prisma.wikiRevision.findUnique.mockResolvedValue({ id: 2, pageId: 5, title: 'Cũ', content: 'bản cũ' });
      await service.restore(dev, 5, 2);
      expect(callArg(prisma.wikiRevision.create)).toMatchObject({ data: { content: 'v1' } });
      expect(callArg(prisma.wikiPage.update)).toMatchObject({ data: { title: 'Cũ', content: 'bản cũ' } });
      prisma.wikiRevision.findUnique.mockResolvedValue({ id: 3, pageId: 99, title: 'x', content: 'y' });
      await expect(service.restore(dev, 5, 3)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
