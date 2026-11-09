import { ForbiddenException } from '@nestjs/common';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { fold, relevance, snippet, termVariants, tokenize } from './search-text';
import { SearchService } from './search.service';

const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };

describe('search-text', () => {
  it('fold bỏ dấu và hạ chữ thường', () => {
    expect(fold('Đăng NHẬP')).toBe('dang nhap');
  });
  it('tokenize: bỏ ký tự đại diện LIKE, trùng, giới hạn số từ', () => {
    expect(tokenize('  đăng   nhập  đăng ')).toEqual(['đăng', 'nhập']);
    expect(tokenize('50%_off')).toEqual(['50off']);
    expect(tokenize('')).toEqual([]);
    expect(tokenize('a b c d e f g h')).toHaveLength(6);
  });
  it('termVariants: thử cả d↔đ vì MySQL coi đ khác d', () => {
    expect(termVariants('dang')).toEqual(['dang', 'đang']);
    expect(termVariants('đăng')).toEqual(['đăng', 'dăng']);
    expect(termVariants('api')).toEqual(['api']);
  });
  it('relevance: tiêu đề nặng hơn nội dung, cụm đầy đủ trong tiêu đề được cộng thêm, không phân biệt dấu', () => {
    const title = relevance(['dang', 'nhap'], 'Lỗi đăng nhập Safari', '');
    const body = relevance(['dang', 'nhap'], 'Tổng quan', 'người dùng đăng nhập thất bại');
    expect(title).toBeGreaterThan(body);
    expect(title).toBe(3 + 3 + 5);
  });
  it('snippet lấy ngữ cảnh quanh vị trí khớp đầu tiên (khớp không dấu), có dấu … ở đầu/cuối', () => {
    const text = `${'Lorem ipsum dolor sit amet '.repeat(10)}Trang ĐĂNG NHẬP hiển thị lỗi ${'sau đó là chữ khác '.repeat(10)}`;
    const s = snippet(['dang'], text);
    expect(s.toLowerCase()).toContain('đăng');
    expect(s.startsWith('…') && s.endsWith('…')).toBe(true);
    expect(snippet(['zzz'], 'Một đoạn ngắn')).toBe('Một đoạn ngắn');
    expect(snippet(['a'], '')).toBe('');
  });
});

describe('SearchService', () => {
  let prisma: PrismaMock;
  let service: SearchService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.wikiPage.findMany.mockResolvedValue([]);
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.release.findMany.mockResolvedValue([]);
    (prisma.attachment as unknown as Record<string, jest.Mock>).findMany.mockResolvedValue([]);
    const p = asPrisma(prisma);
    service = new SearchService(p, new ProjectAccessService(p), { visibleWhere: jest.fn().mockReturnValue({ ORVISIBLE: true }) } as unknown as AttachmentsService);
  });

  it('từ khóa rỗng không truy vấn gì', async () => {
    const result = await service.search(member, '   ');
    expect(result.total).toBe(0);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('mọi truy vấn bị giới hạn trong dự án người dùng được xem và AND giữa các từ khóa', async () => {
    await service.search(member, 'đăng nhập');
    const where = (callArg(prisma.task.findMany) as { where: { project: unknown; AND: { OR: unknown[] }[] } }).where;
    expect(where.project).toBeDefined();
    expect(where.AND).toHaveLength(2); // hai từ khóa, mỗi từ khóa OR trên các trường (và các biến thể d/đ)
    expect(JSON.stringify(where.AND[0])).toContain('đăng');
    expect(JSON.stringify(where.AND[0])).toContain('dăng');
    const wiki = (callArg(prisma.wikiPage.findMany) as { where: { project: unknown } }).where;
    expect(wiki.project).toBeDefined();
    const files = (callArg((prisma.attachment as unknown as Record<string, jest.Mock>).findMany) as { where: { AND: unknown[] } }).where.AND;
    expect(files[0]).toEqual({ ORVISIBLE: true }); // file dùng điều kiện quyền chung AttachmentsService.visibleWhere
  });

  it('gom nhóm, sắp theo độ liên quan, bỏ nhóm rỗng', async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: 1, title: 'Tổng quan', description: 'có đăng nhập ở đây', projectId: 1, project: { name: 'P' } },
      { id: 2, title: 'Lỗi đăng nhập', description: '', projectId: 1, project: { name: 'P' } },
    ]);
    prisma.wikiPage.findMany.mockResolvedValue([{ id: 7, title: 'Hướng dẫn', content: 'Cách đăng nhập hệ thống', projectId: 1, project: { name: 'P' } }]);
    const result = await service.search(member, 'đăng nhập');
    expect(result.groups.map((g) => g.kind)).toEqual(['task', 'wiki']);
    expect(result.groups[0]?.hits.map((h) => h.id)).toEqual([2, 1]); // tiêu đề khớp xếp trước
    expect(result.groups[1]?.hits[0]).toMatchObject({ link: '/projects/1/wiki/7', projectName: 'P' });
    expect(result.total).toBe(3);
  });

  it('lọc theo dự án mà mình không thuộc => 403', async () => {
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(service.search(member, 'x', 1)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
