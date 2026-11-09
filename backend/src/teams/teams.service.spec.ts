import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { TeamsService } from './teams.service';

const admin: AuthUser = { id: 1, email: 'a@x.vn', name: 'Admin', role: 'admin' };
const lead: AuthUser = { id: 10, email: 'l@x.vn', name: 'Leader', role: 'leader' };
const otherLead: AuthUser = { id: 11, email: 'l2@x.vn', name: 'Leader 2', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'Member', role: 'member' };
const TEAM = { id: 3, name: 'Nhóm Web', description: null, leaderId: 10, createdAt: new Date() };

describe('TeamsService', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let service: TeamsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    prisma.team.findUnique.mockResolvedValue(TEAM);
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.team.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 9, ...data, leader: {}, _count: { members: 1, projects: 0 } }));
    prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'leader' });
    prisma.teamMember.findUnique.mockResolvedValue(null);
    prisma.teamMember.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    service = new TeamsService(asPrisma(prisma), { notify } as unknown as NotificationsService);
  });

  describe('phạm vi nhìn thấy', () => {
    it('admin thấy tất cả; người khác chỉ thấy nhóm mình dẫn dắt hoặc tham gia', () => {
      expect(service.visibleWhere(admin)).toEqual({});
      expect(service.visibleWhere(member)).toEqual({ OR: [{ leaderId: 20 }, { members: { some: { userId: 20 } } }] });
    });

    it('xem nhóm không thuộc phạm vi => 404 (không lộ sự tồn tại)', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.get(member, 3)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('member không tạo được nhóm', async () => {
      await expect(service.create(member, { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('trưởng nhóm tạo nhóm: chính họ là leader và là thành viên đầu tiên', async () => {
      await service.create(lead, { name: 'Nhóm mới' });
      expect(callArg(prisma.team.create)).toMatchObject({ data: { name: 'Nhóm mới', leaderId: 10, members: { create: [{ userId: 10 }] } } });
    });

    it('chỉ admin được chỉ định người khác làm trưởng nhóm; leader đích phải có vai trò phù hợp', async () => {
      await expect(service.create(lead, { name: 'X', leaderId: 11 })).rejects.toBeInstanceOf(ForbiddenException);
      prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'member' });
      await expect(service.create(admin, { name: 'X', leaderId: 20 })).rejects.toBeInstanceOf(BadRequestException);
      prisma.user.findUnique.mockResolvedValue({ isActive: false, role: 'leader' });
      await expect(service.create(admin, { name: 'X', leaderId: 11 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('tên trùng => 409', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 2 });
      await expect(service.create(lead, { name: 'Nhóm Web' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('quản lý (cần là trưởng nhóm đó hoặc admin)', () => {
    it('leader khác và member bị chặn ở mọi thao tác ghi', async () => {
      for (const u of [otherLead, member]) {
        await expect(service.update(u, 3, { name: 'Y' })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.remove(u, 3)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.addMember(u, 3, { userId: 5 })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.updateMember(u, 3, 5, { specialty: 'qa' })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.removeMember(u, 3, 5)).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it('chỉ admin đổi trưởng nhóm; trưởng nhóm mới tự thành thành viên', async () => {
      prisma.team.update.mockResolvedValue({ ...TEAM, leader: {}, _count: { members: 2, projects: 0 } });
      prisma.teamMember.upsert.mockResolvedValue({});
      await expect(service.update(lead, 3, { leaderId: 11 })).rejects.toBeInstanceOf(ForbiddenException);
      await service.update(admin, 3, { leaderId: 11 });
      expect(callArg(prisma.teamMember.upsert)).toMatchObject({ where: { teamId_userId: { teamId: 3, userId: 11 } } });
    });
  });

  describe('thành viên', () => {
    beforeEach(() => {
      prisma.team.findFirst.mockResolvedValue({ ...TEAM, leader: {}, _count: { members: 2, projects: 1 } });
      prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'member' });
    });

    it('thêm vào nhóm đồng thời thêm vào mọi dự án của nhóm và báo cho người đó', async () => {
      prisma.project.findMany.mockResolvedValue([
        { id: 7, name: 'Dự án 7' },
        { id: 8, name: 'Dự án 8' },
      ]);
      prisma.projectMember.createMany.mockResolvedValue({ count: 2 });
      await service.addMember(lead, 3, { userId: 5, specialty: 'qa' });
      expect(callArg(prisma.teamMember.create)).toMatchObject({ data: { teamId: 3, userId: 5, specialty: 'qa' } });
      expect(callArg(prisma.projectMember.createMany)).toMatchObject({ data: [{ projectId: 7, userId: 5 }, { projectId: 8, userId: 5 }], skipDuplicates: true });
      expect((callArg(notify) as { type: string }[]).map((n) => n.type)).toEqual(['team_added', 'project_added', 'project_added']);
    });

    it('không thêm admin, người bị vô hiệu hóa hoặc người đã trong nhóm', async () => {
      prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'admin' });
      await expect(service.addMember(lead, 3, { userId: 1 })).rejects.toBeInstanceOf(BadRequestException);
      prisma.user.findUnique.mockResolvedValue({ isActive: false, role: 'member' });
      await expect(service.addMember(lead, 3, { userId: 5 })).rejects.toBeInstanceOf(BadRequestException);
      prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'member' });
      prisma.teamMember.findUnique.mockResolvedValue({ teamId: 3, userId: 5 });
      await expect(service.addMember(lead, 3, { userId: 5 })).rejects.toBeInstanceOf(ConflictException);
    });

    it('không gỡ được trưởng nhóm; gỡ người không thuộc nhóm => 404', async () => {
      await expect(service.removeMember(lead, 3, 10)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.removeMember(lead, 3, 5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
