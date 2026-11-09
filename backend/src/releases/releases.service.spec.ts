import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { ReleasesService } from './releases.service';
import { compareVersions, normalizeVersion } from './version';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'M', role: 'member' };
const NOW = new Date('2026-11-10T03:00:00Z');

describe('version', () => {
  it('chuẩn hóa semver về dạng vX.Y.Z[-pre]', () => {
    expect(normalizeVersion('1.1.0')).toBe('v1.1.0');
    expect(normalizeVersion(' V2.0.10-rc.1 ')).toBe('v2.0.10-rc.1');
    expect(normalizeVersion('v01.02.03')).toBe('v1.2.3');
  });
  it('từ chối định dạng sai', () => {
    for (const bad of ['1.1', 'v1', '1.1.0.0', 'abc', '', 'v1.1.x', '1.1.0-']) expect(normalizeVersion(bad)).toBeNull();
  });
  it('so sánh theo số, không theo chuỗi; bản pre-release nhỏ hơn bản chính thức', () => {
    expect(compareVersions('v1.10.0', 'v1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('v2.0.0', 'v2.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareVersions('v2.0.0-rc.1', 'v2.0.0-rc.2')).toBeLessThan(0);
    expect(compareVersions('v1.0.0', 'v1.0.0')).toBe(0);
  });
});

describe('ReleasesService', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let service: ReleasesService;
  const rel = (over: object = {}) => ({ id: 3, projectId: 1, version: 'v1.1.0', name: null, description: null, status: 'planned', releasedAt: null, createdById: 10, createdAt: NOW, ...over });

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.projectMember.findMany.mockResolvedValue([{ userId: 10 }, { userId: 20 }, { userId: 21 }]);
    prisma.release.findUnique.mockResolvedValue(rel());
    prisma.release.findFirst.mockResolvedValue(null);
    prisma.release.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 9, ...data }));
    prisma.release.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...rel(), ...data }));
    prisma.task.count.mockResolvedValue(0);
    prisma.task.findMany.mockResolvedValue([]);
    const p = asPrisma(prisma);
    service = new ReleasesService(p, new ProjectAccessService(p), { notify } as unknown as NotificationsService);
  });

  describe('create/update/delete', () => {
    it('chuẩn hóa số phiên bản khi lưu; sai định dạng bị từ chối; trùng => 409', async () => {
      await service.create(owner, 1, { version: '1.2.0', name: 'Mùa thu' });
      expect(callArg(prisma.release.create)).toMatchObject({ data: { projectId: 1, version: 'v1.2.0', name: 'Mùa thu', createdById: 10 } });
      await expect(service.create(owner, 1, { version: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
      prisma.release.findFirst.mockResolvedValue({ id: 5 });
      await expect(service.create(owner, 1, { version: 'v1.2.0' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('chỉ leader dự án / admin quản lý; member chỉ xem', async () => {
      prisma.release.findMany.mockResolvedValue([]);
      await expect(service.list(member, 1)).resolves.toEqual([]);
      await expect(service.create(member, 1, { version: '1.0.0' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.update(member, 3, { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(member, 3)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.publish(member, 3)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sửa version sang giá trị đã có bị chặn; không tồn tại => 404', async () => {
      prisma.release.findFirst.mockResolvedValue({ id: 5 });
      await expect(service.update(owner, 3, { version: '2.0.0' })).rejects.toBeInstanceOf(ConflictException);
      prisma.release.findUnique.mockResolvedValue(null);
      await expect(service.remove(owner, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('xếp phiên bản mới nhất trước theo semver và tính số liệu từng phiên bản', async () => {
      prisma.release.findMany.mockResolvedValue([rel({ id: 1, version: 'v1.9.0' }), rel({ id: 2, version: 'v1.10.0' })]);
      prisma.task.findMany
        .mockResolvedValueOnce([
          { fixReleaseId: 2, type: 'bug', status: { category: 'done' } },
          { fixReleaseId: 2, type: 'story', status: { category: 'done' } },
          { fixReleaseId: 2, type: 'task', status: { category: 'in_progress' } },
        ])
        .mockResolvedValueOnce([{ foundReleaseId: 1 }]);
      const result = await service.list(member, 1);
      expect(result.map((r) => r.version)).toEqual(['v1.10.0', 'v1.9.0']);
      expect(result[0]?.stats).toEqual({ items: 3, doneItems: 2, bugsFixed: 1, openBugsFound: 0 });
      expect(result[1]?.stats.openBugsFound).toBe(1);
    });
  });

  describe('publish', () => {
    it('còn việc chưa xong thì chặn, trừ khi force', async () => {
      prisma.task.count.mockResolvedValue(2);
      await expect(service.publish(owner, 3, false, NOW)).rejects.toThrow(/2 việc/);
      expect(prisma.release.update).not.toHaveBeenCalled();
      await service.publish(owner, 3, true, NOW);
      expect(callArg(prisma.release.update)).toMatchObject({ data: { status: 'released', releasedAt: NOW } });
    });

    it('phát hành báo cho thành viên (trừ người bấm) kèm projectId để đăng Slack; không phát hành hai lần', async () => {
      await service.publish(owner, 3, false, NOW);
      const notices = callArg(notify) as { userId: number; type: string; projectId: number }[];
      expect(notices.map((n) => n.userId).sort()).toEqual([20, 21]);
      expect(notices.every((n) => n.type === 'release_published' && n.projectId === 1)).toBe(true);
      prisma.release.findUnique.mockResolvedValue(rel({ status: 'released' }));
      await expect(service.publish(owner, 3, false, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('release notes', () => {
    it('phân nhóm tính năng / sửa lỗi / chưa hoàn thành', () => {
      const notes = service.buildNotes({ version: 'v1.1.0', name: 'Mùa thu', description: 'Bản lớn' }, [
        { id: 1, title: 'Đăng nhập SSO', type: 'story', done: true },
        { id: 2, title: 'Lỗi thanh toán', type: 'bug', done: true },
        { id: 3, title: 'Báo cáo PDF', type: 'task', done: false },
      ]);
      expect(notes).toContain('## v1.1.0 — Mùa thu');
      expect(notes).toContain('### Tính năng và cải tiến\n- Đăng nhập SSO (#1)');
      expect(notes).toContain('### Sửa lỗi\n- Lỗi thanh toán (#2)');
      expect(notes).toContain('### Chưa hoàn thành\n- Báo cáo PDF (#3)');
      expect(service.buildNotes({ version: 'v1.0.0', name: null, description: null }, [])).toContain('Chưa có công việc nào');
    });
  });
});
