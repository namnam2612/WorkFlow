import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { LeavesService } from './leaves.service';

const admin: AuthUser = { id: 1, email: 'a@x.vn', name: 'Admin', role: 'admin' };
const lead: AuthUser = { id: 10, email: 'l@x.vn', name: 'Leader', role: 'leader' };
const otherLead: AuthUser = { id: 11, email: 'l2@x.vn', name: 'Leader 2', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'Member', role: 'member' };
// 2026-11-10 (Thứ Ba) 10:00 giờ VN
const NOW = new Date('2026-11-10T03:00:00Z');
const d = (iso: string) => new Date(`${iso}T00:00:00+07:00`);

const row = (over: object = {}) => ({
  id: 5,
  userId: 20,
  startDate: d('2026-11-16'),
  endDate: d('2026-11-18'),
  type: 'annual',
  status: 'pending',
  reason: 'Việc gia đình',
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: NOW,
  user: { id: 20, name: 'Member', avatarUrl: null },
  reviewer: null,
  ...over,
});

describe('LeavesService', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let service: LeavesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    prisma.leave.findMany.mockResolvedValue([]);
    prisma.leave.create.mockImplementation(({ data }: { data: object }) => Promise.resolve(row(data)));
    prisma.leave.update.mockImplementation(({ data }: { data: object }) => Promise.resolve(row(data)));
    prisma.leave.findUnique.mockResolvedValue(row());
    // Chỉ leader 10 dẫn nhóm có user 20; truy vấn "đồng đội" (members.some) trả user 20 cho mọi người
    prisma.teamMember.findMany.mockImplementation(({ where }: { where: { team: { leaderId?: number; members?: object } } }) =>
      Promise.resolve(where.team.leaderId === 10 ? [{ userId: 20 }] : where.team.members ? [{ userId: 20 }] : []),
    );
    prisma.projectMember.findMany.mockResolvedValue([]);
    prisma.team.findMany.mockResolvedValue([{ leaderId: 10 }]);
    prisma.project.findMany.mockResolvedValue([{ createdById: 10 }, { createdById: 11 }]);
    const p = asPrisma(prisma);
    service = new LeavesService(p, new ProjectAccessService(p), { notify } as unknown as NotificationsService);
  });

  describe('create', () => {
    it('thành viên: đơn chờ duyệt và báo cho trưởng nhóm / leader dự án của mình', async () => {
      const view = await service.create(member, { startDate: '2026-11-16', endDate: '2026-11-18', reason: 'Việc gia đình' }, NOW);
      expect(callArg(prisma.leave.create)).toMatchObject({ data: { userId: 20, status: 'pending', type: 'annual' } });
      expect(view.canCancel).toBe(true);
      expect((callArg(notify) as { userId: number; type: string }[]).map((n) => [n.userId, n.type]).sort()).toEqual([
        [10, 'leave_requested'],
        [11, 'leave_requested'],
      ]);
    });

    it('leader/admin tự duyệt đơn của chính mình và không cần báo ai', async () => {
      await service.create(lead, { startDate: '2026-11-16', endDate: '2026-11-16' }, NOW);
      expect(callArg(prisma.leave.create)).toMatchObject({ data: { status: 'approved', reviewedById: 10 } });
      expect(notify).not.toHaveBeenCalled();
    });

    it('từ chối ngày sai, đảo ngược, quá dài, chỉ cuối tuần, quá xa trong quá khứ, hoặc trùng đơn khác', async () => {
      await expect(service.create(member, { startDate: '2026-13-01', endDate: '2026-13-02' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create(member, { startDate: '2026-11-18', endDate: '2026-11-16' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create(member, { startDate: '2026-11-16', endDate: '2027-02-16' }, NOW)).rejects.toThrow(/tối đa 60/);
      await expect(service.create(member, { startDate: '2026-11-14', endDate: '2026-11-15' }, NOW)).rejects.toThrow(/thứ bảy/);
      await expect(service.create(member, { startDate: '2026-01-05', endDate: '2026-01-06' }, NOW)).rejects.toThrow(/90 ngày/);
      prisma.leave.findMany.mockResolvedValue([{ startDate: d('2026-11-17'), endDate: d('2026-11-20') }]);
      await expect(service.create(member, { startDate: '2026-11-16', endDate: '2026-11-18' }, NOW)).rejects.toThrow(/trùng/);
    });
  });

  describe('review', () => {
    it('leader của người xin nghỉ duyệt được, người nhận được thông báo', async () => {
      const view = await service.review(lead, 5, { approve: true, note: 'OK' }, NOW);
      expect(callArg(prisma.leave.update)).toMatchObject({ data: { status: 'approved', reviewedById: 10, reviewNote: 'OK' } });
      expect(view.status).toBe('approved');
      expect(callArg(notify)).toEqual([expect.objectContaining({ userId: 20, type: 'leave_reviewed', message: expect.stringContaining('duyệt') as string })]);
    });

    it('từ chối ghi trạng thái rejected', async () => {
      await service.review(admin, 5, { approve: false }, NOW);
      expect(callArg(prisma.leave.update)).toMatchObject({ data: { status: 'rejected' } });
    });

    it('không tự duyệt đơn của mình; leader không liên quan, thành viên thì không duyệt được', async () => {
      prisma.leave.findUnique.mockResolvedValue(row({ userId: 10 }));
      await expect(service.review(lead, 5, { approve: true })).rejects.toBeInstanceOf(ForbiddenException);
      prisma.leave.findUnique.mockResolvedValue(row({ userId: 99 }));
      await expect(service.review(lead, 5, { approve: true })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.review(member, 5, { approve: true })).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.leave.update).not.toHaveBeenCalled();
    });

    it('chỉ duyệt đơn đang chờ; không tồn tại => 404', async () => {
      prisma.leave.findUnique.mockResolvedValue(row({ status: 'approved' }));
      await expect(service.review(lead, 5, { approve: true })).rejects.toBeInstanceOf(BadRequestException);
      prisma.leave.findUnique.mockResolvedValue(null);
      await expect(service.review(lead, 9, { approve: true })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('chỉ chủ đơn hủy; đơn đã kết thúc hoặc đã bị từ chối thì không hủy được', async () => {
      await expect(service.cancel(lead, 5, NOW)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.cancel(member, 5, NOW)).resolves.toMatchObject({ status: 'cancelled' });
      prisma.leave.findUnique.mockResolvedValue(row({ status: 'rejected' }));
      await expect(service.cancel(member, 5, NOW)).rejects.toBeInstanceOf(BadRequestException);
      prisma.leave.findUnique.mockResolvedValue(row({ endDate: d('2026-11-05') }));
      await expect(service.cancel(member, 5, NOW)).rejects.toThrow(/đã kết thúc/);
    });
  });

  describe('list - phạm vi nhìn thấy', () => {
    it('admin thấy tất cả không lọc theo người', async () => {
      await service.list(admin, {});
      expect((callArg(prisma.leave.findMany) as { where: { AND: object[] } }).where.AND[0]).toEqual({});
    });

    it('member: đơn của mình + đơn ĐÃ DUYỆT của đồng đội; leader: thêm mọi đơn của người mình duyệt', async () => {
      prisma.projectMember.findMany.mockResolvedValue([{ userId: 30 }]);
      await service.list(member, {});
      const scope = (callArg(prisma.leave.findMany) as { where: { AND: Record<string, unknown>[] } }).where.AND[0] as { OR: object[] };
      expect(scope.OR).toContainEqual({ userId: 20 });
      expect(scope.OR).toContainEqual({ userId: { in: [30, 20] }, status: 'approved' }); // đồng đội: chỉ đơn đã duyệt
      expect(scope.OR).toContainEqual({ userId: { in: [] } }); // member không duyệt ai
    });

    it('đồng đội thấy ngày nghỉ nhưng không thấy lý do và ghi chú; người duyệt và chủ đơn thấy đầy đủ', async () => {
      prisma.leave.findMany.mockResolvedValue([row({ status: 'approved', reviewNote: 'ghi chú nội bộ' })]);
      const asColleague = await service.list({ ...member, id: 21 }, {});
      expect(asColleague[0]).toMatchObject({ reason: null, reviewNote: null, canReview: false });
      const asOwner = await service.list(member, {});
      expect(asOwner[0]).toMatchObject({ reason: 'Việc gia đình', reviewNote: 'ghi chú nội bộ' });
      const asReviewer = await service.list(lead, {});
      expect(asReviewer[0]).toMatchObject({ reason: 'Việc gia đình' });
    });

    it('chỉ đơn chờ duyệt của người mình quản lý mới có canReview', async () => {
      prisma.leave.findMany.mockResolvedValue([row({ status: 'pending' })]);
      expect((await service.list(lead, {}))[0]?.canReview).toBe(true);
      expect((await service.list(otherLead, {}))[0]?.canReview).toBe(false); // leader 11 không dẫn nhóm nào có user 20
    });
  });
});
