import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Release } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { taskInclude, toTaskView } from '../tasks/task-view';
import { CreateReleaseDto, UpdateReleaseDto } from './dto/release.dto';
import { compareVersions, normalizeVersion } from './version';

export interface ReleaseStats {
  /** Việc gắn vào phiên bản (kể cả Bug đã sửa) */
  items: number;
  doneItems: number;
  /** Bug được sửa trong phiên bản */
  bugsFixed: number;
  /** Bug phát hiện ở phiên bản này mà chưa xong */
  openBugsFound: number;
}

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Phiên bản mới nhất trước (theo semver) */
  async list(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    const releases = await this.prisma.release.findMany({ where: { projectId } });
    const stats = await this.statsFor(releases.map((r) => r.id));
    return releases
      .sort((a, b) => compareVersions(b.version, a.version))
      .map((r) => ({ ...r, stats: stats.get(r.id) ?? emptyStats() }));
  }

  async get(user: AuthUser, id: number) {
    const release = await this.findOrThrow(id);
    await this.access.assertCanView(user, release.projectId);
    const [fixes, found] = await Promise.all([
      this.prisma.task.findMany({ where: { fixReleaseId: id }, include: taskInclude, orderBy: [{ type: 'asc' }, { id: 'asc' }] }),
      this.prisma.task.findMany({ where: { foundReleaseId: id }, include: taskInclude, orderBy: { id: 'asc' } }),
    ]);
    const stats = (await this.statsFor([id])).get(id) ?? emptyStats();
    return {
      ...release,
      stats,
      fixes: fixes.map(toTaskView),
      found: found.map(toTaskView),
      notes: this.buildNotes(release, fixes.map((t) => ({ id: t.id, title: t.title, type: t.type, done: t.status.category === 'done' }))),
    };
  }

  async create(user: AuthUser, projectId: number, dto: CreateReleaseDto): Promise<Release> {
    await this.access.assertCanManage(user, projectId);
    const version = this.parseVersion(dto.version);
    await this.assertVersionFree(projectId, version);
    return this.prisma.release.create({ data: { projectId, version, name: dto.name ?? null, description: dto.description ?? null, createdById: user.id } });
  }

  async update(user: AuthUser, id: number, dto: UpdateReleaseDto): Promise<Release> {
    const release = await this.findOrThrow(id);
    await this.access.assertCanManage(user, release.projectId);
    let version: string | undefined;
    if (dto.version !== undefined) {
      version = this.parseVersion(dto.version);
      if (version !== release.version) await this.assertVersionFree(release.projectId, version, id);
    }
    return this.prisma.release.update({ where: { id }, data: { version, name: dto.name, description: dto.description } });
  }

  /** Xóa phiên bản: việc gắn vào nó chỉ bị bỏ liên kết (khóa ngoại SetNull) */
  async remove(user: AuthUser, id: number): Promise<void> {
    const release = await this.findOrThrow(id);
    await this.access.assertCanManage(user, release.projectId);
    await this.prisma.release.delete({ where: { id } });
  }

  /**
   * Phát hành: ghi thời điểm phát hành, báo cho thành viên dự án (và kênh Slack nếu có).
   * Còn việc chưa xong trong phiên bản thì cần `force` để tránh phát hành nhầm.
   */
  async publish(user: AuthUser, id: number, force = false, now: Date = new Date()): Promise<Release> {
    const release = await this.findOrThrow(id);
    const project = await this.access.assertCanManage(user, release.projectId);
    if (release.status === 'released') throw new BadRequestException('Phiên bản này đã được phát hành');
    const open = await this.prisma.task.count({ where: { fixReleaseId: id, status: { category: { not: 'done' } } } });
    if (open > 0 && !force) throw new BadRequestException(`Còn ${open} việc chưa hoàn thành trong phiên bản này. Hoàn thành chúng hoặc chọn phát hành bất chấp.`);
    const updated = await this.prisma.release.update({ where: { id }, data: { status: 'released', releasedAt: now } });
    const members = await this.prisma.projectMember.findMany({ where: { projectId: release.projectId }, select: { userId: true } });
    const recipients = new Set([project.createdById, ...members.map((m) => m.userId)]);
    recipients.delete(user.id);
    await this.notifications.notify(
      [...recipients].map((userId) => ({
        userId,
        type: 'release_published',
        message: `Đã phát hành ${release.version}${release.name ? ` — ${release.name}` : ''}`,
        link: `/projects/${release.projectId}/releases/${id}`,
        projectId: release.projectId,
      })),
    );
    return updated;
  }

  // ---------------------------------------------------------------- helpers

  /** Release notes dạng Markdown tạo tự động từ các việc gắn vào phiên bản */
  buildNotes(release: Pick<Release, 'version' | 'name' | 'description'>, items: { id: number; title: string; type: string; done: boolean }[]): string {
    const done = items.filter((i) => i.done);
    const features = done.filter((i) => i.type !== 'bug');
    const bugs = done.filter((i) => i.type === 'bug');
    const pending = items.filter((i) => !i.done);
    const lines = [`## ${release.version}${release.name ? ` — ${release.name}` : ''}`];
    if (release.description) lines.push('', release.description);
    if (features.length > 0) lines.push('', '### Tính năng và cải tiến', ...features.map((i) => `- ${i.title} (#${i.id})`));
    if (bugs.length > 0) lines.push('', '### Sửa lỗi', ...bugs.map((i) => `- ${i.title} (#${i.id})`));
    if (pending.length > 0) lines.push('', '### Chưa hoàn thành', ...pending.map((i) => `- ${i.title} (#${i.id})`));
    if (items.length === 0) lines.push('', '_Chưa có công việc nào gắn vào phiên bản này._');
    return lines.join('\n');
  }

  private parseVersion(input: string): string {
    const version = normalizeVersion(input);
    if (!version) throw new BadRequestException('Số phiên bản phải có dạng semver, ví dụ 1.1.0 hoặc v2.0.0-rc.1');
    return version;
  }

  private async assertVersionFree(projectId: number, version: string, exceptId?: number): Promise<void> {
    const dup = await this.prisma.release.findFirst({ where: { projectId, version, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (dup) throw new ConflictException(`Phiên bản ${version} đã tồn tại trong dự án`);
  }

  private async findOrThrow(id: number): Promise<Release> {
    const release = await this.prisma.release.findUnique({ where: { id } });
    if (!release) throw new NotFoundException('Không tìm thấy phiên bản');
    return release;
  }

  private async statsFor(ids: number[]): Promise<Map<number, ReleaseStats>> {
    const result = new Map<number, ReleaseStats>();
    if (ids.length === 0) return result;
    const [fixes, found] = await Promise.all([
      this.prisma.task.findMany({ where: { fixReleaseId: { in: ids } }, select: { fixReleaseId: true, type: true, status: { select: { category: true } } } }),
      this.prisma.task.findMany({ where: { foundReleaseId: { in: ids }, status: { category: { not: 'done' } } }, select: { foundReleaseId: true } }),
    ]);
    const at = (id: number): ReleaseStats => {
      let stat = result.get(id);
      if (!stat) {
        stat = emptyStats();
        result.set(id, stat);
      }
      return stat;
    };
    for (const t of fixes) {
      if (t.fixReleaseId === null) continue;
      const stat = at(t.fixReleaseId);
      stat.items += 1;
      if (t.status.category === 'done') {
        stat.doneItems += 1;
        if (t.type === 'bug') stat.bugsFixed += 1;
      }
    }
    for (const t of found) if (t.foundReleaseId !== null) at(t.foundReleaseId).openBugsFound += 1;
    return result;
  }
}

function emptyStats(): ReleaseStats {
  return { items: 0, doneItems: 0, bugsFixed: 0, openBugsFound: 0 };
}

export type ReleaseWhere = Prisma.ReleaseWhereInput;
