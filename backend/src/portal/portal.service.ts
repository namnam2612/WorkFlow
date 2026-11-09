import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GuestLink } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateGuestLinkDto } from './dto/portal.dto';
import { generateToken, hashToken, looksLikeToken } from './portal-token';

const DAY = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_LINKS = 20;
const NOT_FOUND = 'Liên kết không hợp lệ hoặc đã hết hạn';

interface Progress {
  taskCount: number;
  doneCount: number;
  points: number;
  donePoints: number;
}

/** Phần trăm hoàn thành: theo Story Point nếu có, không thì theo số việc */
const percent = (p: Progress): number => {
  const total = p.points > 0 ? p.points : p.taskCount;
  const done = p.points > 0 ? p.donePoints : p.doneCount;
  return total === 0 ? 0 : Math.round((done / total) * 100);
};

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  // ----------------------------------------------------------- quản lý (leader)

  async list(user: AuthUser, projectId: number) {
    await this.access.assertCanManage(user, projectId);
    const links = await this.prisma.guestLink.findMany({ where: { projectId }, orderBy: { id: 'desc' } });
    return links.map((l) => this.toView(l));
  }

  /** Token chỉ trả về MỘT LẦN ở đây; sau đó không ai xem lại được (DB chỉ lưu băm) */
  async create(user: AuthUser, projectId: number, dto: CreateGuestLinkDto, now: Date = new Date()) {
    await this.access.assertCanManage(user, projectId);
    const active = await this.prisma.guestLink.count({ where: { projectId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } });
    if (active >= MAX_ACTIVE_LINKS) throw new BadRequestException(`Mỗi dự án tối đa ${MAX_ACTIVE_LINKS} liên kết đang hoạt động. Hãy thu hồi bớt liên kết cũ.`);
    const token = generateToken();
    const link = await this.prisma.guestLink.create({
      data: {
        projectId,
        name: dto.name,
        tokenHash: hashToken(token),
        tokenPrefix: token.slice(0, 6),
        expiresAt: dto.expiresInDays ? new Date(now.getTime() + dto.expiresInDays * DAY) : null,
        createdById: user.id,
      },
    });
    return { ...this.toView(link), token };
  }

  async revoke(user: AuthUser, id: number, now: Date = new Date()) {
    const link = await this.prisma.guestLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Không tìm thấy liên kết');
    await this.access.assertCanManage(user, link.projectId);
    if (link.revokedAt) return this.toView(link);
    return this.toView(await this.prisma.guestLink.update({ where: { id }, data: { revokedAt: now } }));
  }

  // ------------------------------------------------------------- công khai

  /**
   * Roadmap chỉ đọc cho khách. CHỈ trả các trường được liệt kê ở đây: không có người dùng, email, bình luận, file,
   * tiêu đề công việc thường hay ghi chú nội bộ. Mọi lý do không hợp lệ (sai token, thu hồi, hết hạn) đều trả cùng một 404.
   */
  async view(token: string, now: Date = new Date()) {
    if (!looksLikeToken(token)) throw new NotFoundException(NOT_FOUND);
    const link = await this.prisma.guestLink.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt.getTime() <= now.getTime())) throw new NotFoundException(NOT_FOUND);

    const projectId = link.projectId;
    const [project, tasks, sprints, releases] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true, description: true, startDate: true, endDate: true } }),
      this.prisma.task.findMany({ where: { projectId, parentId: null }, select: { id: true, title: true, type: true, epicId: true, sprintId: true, storyPoints: true, status: { select: { category: true } } } }),
      this.prisma.sprint.findMany({ where: { projectId }, select: { id: true, name: true, goal: true, status: true, startDate: true, endDate: true }, orderBy: [{ startDate: 'desc' }, { id: 'desc' }], take: 8 }),
      this.prisma.release.findMany({ where: { projectId }, select: { version: true, name: true, status: true, releasedAt: true, description: true }, orderBy: { id: 'desc' }, take: 10 }),
    ]);

    const agg = (items: typeof tasks): Progress => ({
      taskCount: items.length,
      doneCount: items.filter((t) => t.status.category === 'done').length,
      points: items.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
      donePoints: items.filter((t) => t.status.category === 'done').reduce((s, t) => s + (t.storyPoints ?? 0), 0),
    });
    const work = tasks.filter((t) => t.type !== 'epic');
    const epics = tasks.filter((t) => t.type === 'epic').map((e) => ({ title: e.title, progress: percent(agg(work.filter((t) => t.epicId === e.id))), status: e.status.category }));

    // Best-effort: lỗi ghi lượt xem không được làm hỏng trang của khách
    void this.prisma.guestLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 }, lastViewedAt: now } }).catch(() => undefined);

    return {
      project: { ...project, progress: percent(agg(work)) },
      sprints: sprints.map((s) => ({ name: s.name, goal: s.goal, status: s.status, startDate: s.startDate, endDate: s.endDate, progress: percent(agg(work.filter((t) => t.sprintId === s.id))) })).reverse(),
      epics,
      releases: releases.map((r) => ({ version: r.version, name: r.name, status: r.status, releasedAt: r.releasedAt, description: r.description })),
      generatedAt: now.toISOString(),
    };
  }

  private toView(link: GuestLink) {
    const { tokenHash, ...rest } = link;
    void tokenHash;
    return rest;
  }
}
