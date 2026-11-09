import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { buildBugDraft } from './bug-from-test';
import { QaService } from './qa.service';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const qa: AuthUser = { id: 20, email: 'qa@x.vn', name: 'QA', role: 'member' };
const dev: AuthUser = { id: 21, email: 'd@x.vn', name: 'Dev', role: 'member' };
const outsider: AuthUser = { id: 30, email: 'x@x.vn', name: 'X', role: 'member' };
const NOW = new Date('2026-11-10T03:00:00Z');

const CASE = { id: 7, projectId: 1, title: 'Đăng nhập sai mật khẩu', preconditions: 'Có tài khoản', steps: '1. Mở trang\n2. Nhập sai', expected: 'Báo lỗi', priority: 'urgent', archived: false, createdById: 20 };

describe('buildBugDraft', () => {
  it('Bug có đủ tiền điều kiện, các bước, kết quả mong đợi và thực tế; mức nghiêm trọng theo ưu tiên', () => {
    const draft = buildBugDraft({ testCase: { ...CASE, priority: 'urgent' }, runName: 'Regression v1.1', note: 'Không thấy thông báo' });
    expect(draft.title).toBe('Lỗi khi kiểm thử: Đăng nhập sai mật khẩu');
    expect(draft.severity).toBe('critical');
    expect(draft.description).toContain('Regression v1.1');
    expect(draft.description).toContain('Tiền điều kiện:\nCó tài khoản');
    expect(draft.description).toContain('Các bước thực hiện:\n1. Mở trang');
    expect(draft.description).toContain('Kết quả thực tế:\nKhông thấy thông báo');
  });
  it('không có ghi chú / tiền điều kiện vẫn hợp lệ; ưu tiên thấp => nhẹ', () => {
    const draft = buildBugDraft({ testCase: { ...CASE, preconditions: null, priority: 'low' }, runName: 'R', note: null });
    expect(draft.severity).toBe('minor');
    expect(draft.description).not.toContain('Tiền điều kiện');
    expect(draft.description).toContain('(QA chưa ghi chú)');
  });
});

describe('QaService', () => {
  let prisma: PrismaMock;
  let notify: jest.Mock;
  let activity: { log: jest.Mock };
  let service: QaService;
  const run = (over: object = {}) => ({ id: 4, projectId: 1, name: 'Regression', environment: 'staging', releaseId: 2, status: 'open', createdById: 20, createdAt: NOW, closedAt: null, ...over });
  const result = (over: object = {}) => ({ id: 50, runId: 4, testCaseId: 7, status: 'untested', note: null, executedById: null, executedAt: null, bugId: null, run: run(), testCase: CASE, ...over });

  beforeEach(() => {
    prisma = createPrismaMock();
    notify = jest.fn().mockResolvedValue(undefined);
    activity = { log: jest.fn().mockResolvedValue({}) };
    prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'P', createdById: 10 });
    prisma.projectMember.findUnique.mockImplementation(({ where }: { where: { projectId_userId: { userId: number } } }) => Promise.resolve(where.projectId_userId.userId === 30 ? null : { projectId: 1, userId: where.projectId_userId.userId }));
    prisma.testCase.findUnique.mockResolvedValue(CASE);
    prisma.testCase.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }]);
    prisma.testRun.findUnique.mockResolvedValue(run());
    prisma.testRun.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 4, ...data }));
    prisma.testRun.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...run(), ...data }));
    prisma.testResult.findUnique.mockResolvedValue(result());
    prisma.testResult.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...result(), ...data }));
    prisma.testResult.count.mockResolvedValue(0);
    prisma.projectStatus.findFirst.mockResolvedValue({ id: 11 });
    prisma.task.aggregate.mockResolvedValue({ _max: { position: 3 } });
    prisma.task.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 99, ...data }));
    prisma.release.findUnique.mockResolvedValue({ projectId: 1 });
    const p = asPrisma(prisma);
    service = new QaService(p, new ProjectAccessService(p), activity as unknown as ActivityService, { notify } as unknown as NotificationsService, { taskChanged: jest.fn() } as unknown as RealtimeService);
  });

  describe('quyền', () => {
    it('người ngoài dự án không xem/tạo được; thành viên (QA/dev) viết test case, tạo đợt chạy', async () => {
      await expect(service.listCases(outsider, 1, false)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.createRun(outsider, 1, { name: 'R' })).rejects.toBeInstanceOf(ForbiddenException);
      prisma.testCase.create.mockResolvedValue(CASE);
      await expect(service.createCase(qa, 1, { title: 'T', steps: 's', expected: 'e' })).resolves.toBeDefined();
      expect(callArg(prisma.testCase.create)).toMatchObject({ data: { projectId: 1, createdById: 20, priority: 'medium' } });
    });

    it('xóa test case: người tạo hoặc leader; người khác thì không', async () => {
      await expect(service.removeCase(dev, 7)).rejects.toBeInstanceOf(ForbiddenException);
      prisma.testCase.delete.mockResolvedValue({});
      await expect(service.removeCase(qa, 7)).resolves.toEqual({ archived: false });
      await expect(service.removeCase(owner, 7)).resolves.toEqual({ archived: false });
    });

    it('test case đã có kết quả được lưu trữ thay vì xóa', async () => {
      prisma.testResult.count.mockResolvedValue(3);
      prisma.testCase.update.mockResolvedValue({});
      await expect(service.removeCase(qa, 7)).resolves.toEqual({ archived: true });
      expect(prisma.testCase.delete).not.toHaveBeenCalled();
      expect(callArg(prisma.testCase.update)).toMatchObject({ data: { archived: true } });
    });
  });

  describe('createRun', () => {
    it('tạo kết quả "chưa chạy" cho mọi test case chưa lưu trữ (mặc định)', async () => {
      await service.createRun(qa, 1, { name: 'Regression', environment: 'staging', releaseId: 2 });
      expect(callArg(prisma.testRun.create)).toMatchObject({ data: { projectId: 1, environment: 'staging', releaseId: 2, createdById: 20, results: { create: [{ testCaseId: 7 }, { testCaseId: 8 }] } } });
      expect((callArg(prisma.testCase.findMany) as { where: { archived: boolean } }).where.archived).toBe(false);
    });

    it('từ chối: không có test case nào, test case lạ, phiên bản của dự án khác', async () => {
      prisma.testCase.findMany.mockResolvedValue([]);
      await expect(service.createRun(qa, 1, { name: 'R' })).rejects.toThrow(/Chưa có test case/);
      prisma.testCase.findMany.mockResolvedValue([{ id: 7 }]);
      await expect(service.createRun(qa, 1, { name: 'R', testCaseIds: [7, 99] })).rejects.toBeInstanceOf(BadRequestException);
      prisma.release.findUnique.mockResolvedValue({ projectId: 2 });
      await expect(service.createRun(qa, 1, { name: 'R', releaseId: 2 })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('execute - Fail tự sinh Bug', () => {
    it('Fail tạo Bug ở trạng thái đầu bộ Bug, kế thừa môi trường/phiên bản của đợt chạy và gắn vào kết quả', async () => {
      const out = await service.execute(dev, 50, { status: 'failed', note: 'Không có thông báo' }, NOW);
      expect(callArg(prisma.task.create)).toMatchObject({
        data: { projectId: 1, type: 'bug', statusId: 11, environment: 'staging', foundReleaseId: 2, severity: 'critical', priority: 'urgent', creatorId: 21, position: 4 },
      });
      expect(callArg(prisma.testResult.update)).toMatchObject({ data: { status: 'failed', bugId: 99, executedById: 21, executedAt: NOW } });
      expect(out.createdBug).toEqual({ id: 99, title: 'Lỗi khi kiểm thử: Đăng nhập sai mật khẩu' });
      expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'task_created', detail: expect.objectContaining({ source: 'test_run' }) as object }), prisma);
      expect((callArg(notify) as { userId: number; type: string }[])[0]).toMatchObject({ userId: 10, type: 'bug_created' });
    });

    it('chạy lại Fail không sinh Bug trùng; createBug=false thì không sinh', async () => {
      prisma.testResult.findUnique.mockResolvedValue(result({ status: 'failed', bugId: 77 }));
      const out = await service.execute(dev, 50, { status: 'failed' }, NOW);
      expect(prisma.task.create).not.toHaveBeenCalled();
      expect(out.createdBug).toBeNull();
      prisma.testResult.findUnique.mockResolvedValue(result());
      await service.execute(dev, 50, { status: 'failed', createBug: false }, NOW);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('Pass/Blocked/Skipped không sinh Bug; trả về "chưa chạy" xóa người thực hiện', async () => {
      for (const status of ['passed', 'blocked', 'skipped'] as const) await service.execute(qa, 50, { status }, NOW);
      expect(prisma.task.create).not.toHaveBeenCalled();
      await service.execute(qa, 50, { status: 'untested' }, NOW);
      expect(callArg(prisma.testResult.update, 3)).toMatchObject({ data: { status: 'untested', executedById: null, executedAt: null } });
    });

    it('đợt đã đóng thì không ghi được; người ngoài dự án bị chặn; leader tự báo không gửi cho chính mình', async () => {
      prisma.testResult.findUnique.mockResolvedValue(result({ run: run({ status: 'closed' }) }));
      await expect(service.execute(qa, 50, { status: 'passed' })).rejects.toBeInstanceOf(BadRequestException);
      prisma.testResult.findUnique.mockResolvedValue(result());
      await expect(service.execute(outsider, 50, { status: 'passed' })).rejects.toBeInstanceOf(ForbiddenException);
      await service.execute(owner, 50, { status: 'failed' }, NOW);
      expect(notify).not.toHaveBeenCalled();
    });

    it('không tồn tại => 404', async () => {
      prisma.testResult.findUnique.mockResolvedValue(null);
      await expect(service.execute(qa, 9, { status: 'passed' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('đóng đợt chạy và tổng hợp', () => {
    it('chỉ người tạo hoặc leader đóng; không đóng hai lần', async () => {
      await expect(service.closeRun(dev, 4, NOW)).rejects.toBeInstanceOf(ForbiddenException);
      await service.closeRun(qa, 4, NOW);
      expect(callArg(prisma.testRun.update)).toMatchObject({ data: { status: 'closed', closedAt: NOW } });
      prisma.testRun.findUnique.mockResolvedValue(run({ status: 'closed' }));
      await expect(service.closeRun(owner, 4, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('danh sách đợt chạy: đếm kết quả và tỉ lệ đạt trên số đã chạy', async () => {
      prisma.testRun.findMany.mockResolvedValue([run()]);
      prisma.testResult.groupBy.mockResolvedValue([
        { runId: 4, status: 'passed', _count: { _all: 6 } },
        { runId: 4, status: 'failed', _count: { _all: 2 } },
        { runId: 4, status: 'untested', _count: { _all: 2 } },
      ]);
      const [r] = await service.listRuns(dev, 1);
      expect(r).toMatchObject({ total: 10, executed: 8, passRate: 75 });
      expect(r?.counts).toMatchObject({ passed: 6, failed: 2, untested: 2 });
    });
  });
});
