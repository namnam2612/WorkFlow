import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TestCase, TestResultStatus, TestRun } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { STATUS_SELECT } from '../statuses/status-view';
import { buildBugDraft } from './bug-from-test';
import { CreateTestCaseDto, CreateTestRunDto, ExecuteResultDto, UpdateTestCaseDto } from './dto/qa.dto';

export type ResultCounts = Record<TestResultStatus, number>;
const emptyCounts = (): ResultCounts => ({ untested: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 });

const resultInclude = {
  testCase: { select: { id: true, title: true, preconditions: true, steps: true, expected: true, priority: true, archived: true } },
  bug: { select: { id: true, title: true, status: { select: STATUS_SELECT } } },
} satisfies Prisma.TestResultInclude;

@Injectable()
export class QaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------------------------------------------------------------- cases

  async listCases(user: AuthUser, projectId: number, includeArchived: boolean) {
    await this.access.assertCanView(user, projectId);
    return this.prisma.testCase.findMany({ where: { projectId, ...(includeArchived ? {} : { archived: false }) }, orderBy: [{ id: 'asc' }] });
  }

  /** Mọi thành viên dự án (QA, dev) đều viết được test case */
  async createCase(user: AuthUser, projectId: number, dto: CreateTestCaseDto): Promise<TestCase> {
    await this.access.assertCanView(user, projectId);
    return this.prisma.testCase.create({
      data: { projectId, title: dto.title, preconditions: dto.preconditions ?? null, steps: dto.steps, expected: dto.expected, priority: dto.priority ?? 'medium', createdById: user.id },
    });
  }

  async updateCase(user: AuthUser, id: number, dto: UpdateTestCaseDto): Promise<TestCase> {
    const testCase = await this.findCase(id);
    await this.access.assertCanView(user, testCase.projectId);
    return this.prisma.testCase.update({
      where: { id },
      data: { title: dto.title, preconditions: dto.preconditions, steps: dto.steps, expected: dto.expected, priority: dto.priority, archived: dto.archived },
    });
  }

  /** Xóa: người tạo hoặc leader/admin. Test case đã có kết quả được lưu trữ thay vì xóa để giữ lịch sử. */
  async removeCase(user: AuthUser, id: number): Promise<{ archived: boolean }> {
    const testCase = await this.findCase(id);
    const project = await this.access.assertCanView(user, testCase.projectId);
    if (testCase.createdById !== user.id && !this.access.canManage(user, project)) {
      throw new ForbiddenException('Chỉ người tạo, trưởng nhóm hoặc quản trị viên mới được xóa test case');
    }
    const used = await this.prisma.testResult.count({ where: { testCaseId: id, status: { not: 'untested' } } });
    if (used > 0) {
      await this.prisma.testCase.update({ where: { id }, data: { archived: true } });
      return { archived: true };
    }
    await this.prisma.testCase.delete({ where: { id } });
    return { archived: false };
  }

  // ----------------------------------------------------------------- runs

  async listRuns(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    const runs = await this.prisma.testRun.findMany({ where: { projectId }, include: { release: { select: { id: true, version: true } } }, orderBy: [{ id: 'desc' }] });
    const counts = await this.countsFor(runs.map((r) => r.id));
    return runs.map((r) => ({ ...r, ...this.summarize(counts.get(r.id) ?? emptyCounts()) }));
  }

  async getRun(user: AuthUser, id: number) {
    const run = await this.prisma.testRun.findUnique({ where: { id }, include: { release: { select: { id: true, version: true } } } });
    if (!run) throw new NotFoundException('Không tìm thấy đợt kiểm thử');
    await this.access.assertCanView(user, run.projectId);
    const results = await this.prisma.testResult.findMany({
      where: { runId: id },
      include: { ...resultInclude },
      orderBy: { id: 'asc' },
    });
    const executors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(results.map((r) => r.executedById).filter((v): v is number => v !== null))] } }, select: USER_BRIEF_SELECT });
    const byId = new Map(executors.map((u) => [u.id, u]));
    const counts = emptyCounts();
    for (const r of results) counts[r.status] += 1;
    return { ...run, ...this.summarize(counts), results: results.map((r) => ({ ...r, executedBy: r.executedById === null ? null : (byId.get(r.executedById) ?? null) })) };
  }

  async createRun(user: AuthUser, projectId: number, dto: CreateTestRunDto): Promise<TestRun> {
    await this.access.assertCanView(user, projectId);
    if (dto.releaseId !== undefined && dto.releaseId !== null) {
      const release = await this.prisma.release.findUnique({ where: { id: dto.releaseId }, select: { projectId: true } });
      if (!release || release.projectId !== projectId) throw new BadRequestException('Phiên bản không thuộc dự án này');
    }
    const cases = await this.prisma.testCase.findMany({
      where: { projectId, archived: false, ...(dto.testCaseIds ? { id: { in: dto.testCaseIds } } : {}) },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (dto.testCaseIds && cases.length !== new Set(dto.testCaseIds).size) throw new BadRequestException('Có test case không hợp lệ (đã lưu trữ hoặc thuộc dự án khác)');
    if (cases.length === 0) throw new BadRequestException('Chưa có test case nào để chạy. Hãy tạo test case trước.');
    return this.prisma.testRun.create({
      data: {
        projectId,
        name: dto.name,
        environment: dto.environment ?? null,
        releaseId: dto.releaseId ?? null,
        createdById: user.id,
        results: { create: cases.map((c) => ({ testCaseId: c.id })) },
      },
    });
  }

  async closeRun(user: AuthUser, id: number, now: Date = new Date()): Promise<TestRun> {
    const run = await this.findRun(id);
    const project = await this.access.assertCanView(user, run.projectId);
    if (run.createdById !== user.id && !this.access.canManage(user, project)) throw new ForbiddenException('Chỉ người tạo đợt kiểm thử, trưởng nhóm hoặc quản trị viên mới được đóng');
    if (run.status === 'closed') throw new BadRequestException('Đợt kiểm thử đã đóng');
    return this.prisma.testRun.update({ where: { id }, data: { status: 'closed', closedAt: now } });
  }

  // -------------------------------------------------------------- execute

  /**
   * Ghi kết quả một test case trong đợt chạy. Kết quả Fail tự tạo Bug (môi trường và phiên bản lấy từ đợt chạy)
   * nếu test case này chưa có Bug trong đợt — chạy lại Fail nhiều lần không sinh Bug trùng.
   */
  async execute(user: AuthUser, resultId: number, dto: ExecuteResultDto, now: Date = new Date()) {
    const result = await this.prisma.testResult.findUnique({ where: { id: resultId }, include: { run: true, testCase: true } });
    if (!result) throw new NotFoundException('Không tìm thấy kết quả kiểm thử');
    const project = await this.access.assertCanView(user, result.run.projectId);
    if (result.run.status === 'closed') throw new BadRequestException('Đợt kiểm thử đã đóng, không thể ghi kết quả');

    let bugId = result.bugId;
    let createdBug: { id: number; title: string } | null = null;
    if (dto.status === 'failed' && bugId === null && dto.createBug !== false) {
      createdBug = await this.createBugForFailure(user, project.createdById, result.run, result.testCase, dto.note ?? null);
      bugId = createdBug.id;
    }
    const updated = await this.prisma.testResult.update({
      where: { id: resultId },
      data: { status: dto.status, note: dto.note ?? null, bugId, executedById: dto.status === 'untested' ? null : user.id, executedAt: dto.status === 'untested' ? null : now },
      include: resultInclude,
    });
    return { ...updated, createdBug };
  }

  // ---------------------------------------------------------------- helpers

  private async createBugForFailure(user: AuthUser, leaderId: number, run: TestRun, testCase: TestCase, note: string | null): Promise<{ id: number; title: string }> {
    const draft = buildBugDraft({ testCase, runName: run.name, note });
    const status = await this.prisma.projectStatus.findFirst({ where: { projectId: run.projectId, scope: 'bug' }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
    if (!status) throw new BadRequestException('Dự án chưa có bộ trạng thái Bug');
    const bug = await this.prisma.$transaction(async (tx) => {
      const max = await tx.task.aggregate({ where: { projectId: run.projectId, statusId: status.id, parentId: null }, _max: { position: true } });
      const created = await tx.task.create({
        data: {
          projectId: run.projectId,
          title: draft.title,
          description: draft.description,
          creatorId: user.id,
          type: 'bug',
          statusId: status.id,
          priority: testCase.priority,
          severity: draft.severity,
          environment: run.environment,
          foundReleaseId: run.releaseId,
          position: (max._max.position ?? -1) + 1,
        },
      });
      await this.activity.log({ taskId: created.id, userId: user.id, action: 'task_created', detail: { title: created.title, type: 'bug', source: 'test_run', testRunId: run.id } }, tx);
      return created;
    });
    if (leaderId !== user.id) {
      await this.notifications.notify([
        { userId: leaderId, type: 'bug_created', message: `${user.name} ghi nhận lỗi khi kiểm thử: "${testCase.title}"`, link: `/tasks/${bug.id}`, projectId: run.projectId },
      ]);
    }
    this.realtime.taskChanged(run.projectId, bug.id);
    return { id: bug.id, title: bug.title };
  }

  private summarize(counts: ResultCounts) {
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const executed = total - counts.untested;
    return { counts, total, executed, passRate: executed === 0 ? null : Math.round((counts.passed / executed) * 100) };
  }

  private async countsFor(runIds: number[]): Promise<Map<number, ResultCounts>> {
    const result = new Map<number, ResultCounts>();
    if (runIds.length === 0) return result;
    const rows = await this.prisma.testResult.groupBy({ by: ['runId', 'status'], where: { runId: { in: runIds } }, _count: { _all: true } });
    for (const row of rows) {
      const counts = result.get(row.runId) ?? emptyCounts();
      counts[row.status] = row._count._all;
      result.set(row.runId, counts);
    }
    return result;
  }

  private async findCase(id: number): Promise<TestCase> {
    const testCase = await this.prisma.testCase.findUnique({ where: { id } });
    if (!testCase) throw new NotFoundException('Không tìm thấy test case');
    return testCase;
  }

  private async findRun(id: number): Promise<TestRun> {
    const run = await this.prisma.testRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Không tìm thấy đợt kiểm thử');
    return run;
  }
}
