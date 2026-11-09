import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { generateToken, hashToken, looksLikeToken } from './portal-token';
import { PortalService } from './portal.service';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };
const NOW = new Date('2026-11-10T03:00:00Z');

describe('portal-token', () => {
  it('token ngẫu nhiên, khác nhau mỗi lần, đúng hình dạng; băm ổn định và không lộ token', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(looksLikeToken(a)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
    expect(hashToken(a)).not.toContain(a);
  });
  it('từ chối đầu vào lạ trước khi chạm DB', () => {
    for (const bad of ['', 'abc', 'x'.repeat(100), '../../etc/passwd', 'a b'.repeat(10), "' OR 1=1 --"]) expect(looksLikeToken(bad)).toBe(false);
  });
});

describe('PortalService', () => {
  let prisma: PrismaMock;
  let service: PortalService;
  const link = (over: object = {}) => ({ id: 1, projectId: 1, tokenHash: 'h', tokenPrefix: 'abcdef', name: 'Khách A', expiresAt: null, revokedAt: null, createdById: 10, createdAt: NOW, lastViewedAt: null, viewCount: 0, ...over });

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.guestLink.count.mockResolvedValue(0);
    prisma.guestLink.create.mockImplementation(({ data }: { data: object }) => Promise.resolve(link(data)));
    prisma.guestLink.update.mockResolvedValue({});
    const p = asPrisma(prisma);
    service = new PortalService(p, new ProjectAccessService(p));
  });

  describe('quản lý', () => {
    it('chỉ leader dự án / admin; member bị chặn ở mọi thao tác', async () => {
      await expect(service.list(member, 1)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.create(member, 1, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      prisma.guestLink.findUnique.mockResolvedValue(link());
      await expect(service.revoke(member, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('tạo: trả token đúng MỘT lần, DB chỉ lưu băm + tiền tố; không lộ tokenHash ra ngoài', async () => {
      const out = await service.create(owner, 1, { name: 'Khách A', expiresInDays: 30 }, NOW);
      const stored = (callArg(prisma.guestLink.create) as { data: { tokenHash: string; tokenPrefix: string; expiresAt: Date } }).data;
      expect(stored.tokenHash).toBe(hashToken(out.token));
      expect(stored.tokenHash).not.toContain(out.token);
      expect(stored.tokenPrefix).toBe(out.token.slice(0, 6));
      expect(stored.expiresAt.toISOString()).toBe('2026-12-10T03:00:00.000Z');
      expect('tokenHash' in out).toBe(false);
      prisma.guestLink.findMany.mockResolvedValue([link()]);
      expect(JSON.stringify(await service.list(owner, 1))).not.toContain('tokenHash');
    });

    it('giới hạn số liên kết đang hoạt động; thu hồi đặt revokedAt', async () => {
      prisma.guestLink.count.mockResolvedValue(20);
      await expect(service.create(owner, 1, { name: 'x' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      prisma.guestLink.findUnique.mockResolvedValue(link());
      await service.revoke(owner, 1, NOW);
      expect(callArg(prisma.guestLink.update)).toMatchObject({ data: { revokedAt: NOW } });
      prisma.guestLink.findUnique.mockResolvedValue(null);
      await expect(service.revoke(owner, 9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('view công khai', () => {
    const token = generateToken();
    const seed = () => {
      prisma.project.findUniqueOrThrow.mockResolvedValue({ name: 'Cổng thanh toán', description: 'Mô tả', startDate: null, endDate: null });
      prisma.task.findMany.mockResolvedValue([
        { id: 1, title: 'Epic Thanh toán', type: 'epic', epicId: null, sprintId: null, storyPoints: null, status: { category: 'in_progress' } },
        { id: 2, title: 'BÍ MẬT: lỗi bảo mật nội bộ', type: 'bug', epicId: 1, sprintId: 7, storyPoints: 2, status: { category: 'done' } },
        { id: 3, title: 'Việc nội bộ', type: 'story', epicId: 1, sprintId: 7, storyPoints: 6, status: { category: 'in_progress' } },
      ]);
      prisma.sprint.findMany.mockResolvedValue([{ id: 7, name: 'Sprint 7', goal: 'Ra mắt', status: 'active', startDate: NOW, endDate: NOW }]);
      prisma.release.findMany.mockResolvedValue([{ version: 'v1.0.0', name: 'Bản đầu', status: 'released', releasedAt: NOW, description: 'Ra mắt' }]);
      prisma.guestLink.findUnique.mockResolvedValue(link({ tokenHash: hashToken(token) }));
    };

    it('trả roadmap: tiến độ dự án/sprint/epic tính theo điểm, và KHÔNG chứa tiêu đề công việc nội bộ hay thông tin người dùng', async () => {
      seed();
      const out = await service.view(token, NOW);
      expect(out.project).toMatchObject({ name: 'Cổng thanh toán', progress: 25 }); // 2/8 điểm
      expect(out.epics).toEqual([{ title: 'Epic Thanh toán', progress: 25, status: 'in_progress' }]);
      expect(out.sprints[0]).toMatchObject({ name: 'Sprint 7', progress: 25 });
      expect(out.releases[0]).toMatchObject({ version: 'v1.0.0' });
      const json = JSON.stringify(out);
      expect(json).not.toContain('BÍ MẬT');
      expect(json).not.toContain('Việc nội bộ');
      expect(json).not.toMatch(/email|userId|assignee|comment|attachment/i);
      expect(callArg(prisma.guestLink.findUnique)).toMatchObject({ where: { tokenHash: hashToken(token) } });
    });

    it('sai token, thu hồi, hết hạn đều cho CÙNG một 404 (không lộ lý do); đầu vào lạ không chạm DB', async () => {
      seed();
      prisma.guestLink.findUnique.mockResolvedValue(null);
      const e1 = await service.view(token, NOW).catch((e: unknown) => e);
      prisma.guestLink.findUnique.mockResolvedValue(link({ revokedAt: NOW }));
      const e2 = await service.view(token, NOW).catch((e: unknown) => e);
      prisma.guestLink.findUnique.mockResolvedValue(link({ expiresAt: new Date(NOW.getTime() - 1000) }));
      const e3 = await service.view(token, NOW).catch((e: unknown) => e);
      for (const e of [e1, e2, e3]) expect(e).toBeInstanceOf(NotFoundException);
      expect((e1 as Error).message).toBe((e2 as Error).message);
      expect((e1 as Error).message).toBe((e3 as Error).message);
      prisma.guestLink.findUnique.mockClear();
      await expect(service.view('../../x', NOW)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.guestLink.findUnique).not.toHaveBeenCalled();
    });

    it('liên kết chưa hết hạn vẫn xem được; lỗi ghi lượt xem không làm hỏng trang', async () => {
      seed();
      prisma.guestLink.findUnique.mockResolvedValue(link({ tokenHash: hashToken(token), expiresAt: new Date(NOW.getTime() + 1000) }));
      prisma.guestLink.update.mockRejectedValue(new Error('db'));
      await expect(service.view(token, NOW)).resolves.toBeDefined();
    });
  });
});
