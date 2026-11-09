import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttachmentCleanupService } from '../attachments/attachment-cleanup.service';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { NotificationsService } from '../notifications/notifications.service';
import { SlackService } from '../notifications/slack.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { createDefaultStatuses } from '../statuses/default-statuses';
import { ProjectAccessService } from './project-access.service';

const projectInclude = {
  createdBy: { select: USER_BRIEF_SELECT },
  members: { include: { user: { select: { ...USER_BRIEF_SELECT, email: true, role: true } } }, orderBy: { userId: 'asc' } },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

interface ProjectCounts {
  taskCount: number;
  doneCount: number;
  overdueCount: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
    private readonly attachmentCleanup: AttachmentCleanupService,
    private readonly slack: SlackService,
  ) {}

  async list(user: AuthUser, search?: string) {
    const where: Prisma.ProjectWhereInput = {
      AND: [this.access.visibleProjectWhere(user), search ? { name: { contains: search } } : {}],
    };
    const projects = await this.prisma.project.findMany({ where, include: projectInclude, orderBy: { createdAt: 'desc' } });
    const counts = await this.countsFor(projects.map((p) => p.id));
    return projects.map((p) => this.toView(p, counts.get(p.id)));
  }

  async get(user: AuthUser, id: number) {
    await this.access.assertCanView(user, id);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id }, include: projectInclude });
    const counts = await this.countsFor([id]);
    return this.toView(project, counts.get(id));
  }

  async create(user: AuthUser, dto: CreateProjectDto) {
    this.assertDateRange(dto.startDate, dto.endDate);
    const memberIds = new Set(dto.memberIds ?? []);
    // Trưởng nhóm tạo dự án luôn là thành viên; admin quản lý bằng quyền hệ thống nên không bắt buộc
    if (user.role === 'leader') memberIds.add(user.id);
    await this.assertUsersExistAndActive([...memberIds]);

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          createdById: user.id,
          slackWebhookUrl: dto.slackWebhookUrl ?? null,
          members: { create: [...memberIds].map((userId) => ({ userId })) },
        },
        include: projectInclude,
      });
      await createDefaultStatuses(tx, created.id);
      return created;
    });

    await this.notifications.notify(
      [...memberIds]
        .filter((id) => id !== user.id)
        .map((userId) => ({
          userId,
          type: 'project_added',
          message: `Bạn được thêm vào dự án "${project.name}"`,
          link: `/projects/${project.id}`,
        })),
    );
    return this.toView(project, { taskCount: 0, doneCount: 0, overdueCount: 0 });
  }

  async update(user: AuthUser, id: number, dto: UpdateProjectDto) {
    await this.access.assertCanManage(user, id);
    const current = await this.prisma.project.findUniqueOrThrow({ where: { id } });
    const startDate = dto.startDate === undefined ? current.startDate?.toISOString() : dto.startDate;
    const endDate = dto.endDate === undefined ? current.endDate?.toISOString() : dto.endDate;
    this.assertDateRange(startDate, endDate);

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        slackWebhookUrl: dto.slackWebhookUrl,
      },
      include: projectInclude,
    });
    const counts = await this.countsFor([id]);
    return this.toView(project, counts.get(id));
  }

  /** Gửi một tin thử tới Slack webhook của dự án để người quản lý kiểm tra cấu hình */
  async testSlack(user: AuthUser, id: number): Promise<{ ok: boolean }> {
    await this.access.assertCanManage(user, id);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id }, select: { name: true, slackWebhookUrl: true } });
    if (!project.slackWebhookUrl) throw new BadRequestException('Dự án chưa cấu hình Slack webhook');
    const ok = await this.slack.post(project.slackWebhookUrl, `✅ TaskFlow đã kết nối với kênh này cho dự án *${project.name}*`);
    return { ok };
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    await this.access.assertCanManage(user, id);
    const targets = await this.attachmentCleanup.collectProjectTargets(id);
    await this.prisma.project.delete({ where: { id } });
    await this.attachmentCleanup.cleanup(targets);
  }

  async addMember(user: AuthUser, projectId: number, userId: number) {
    const project = await this.access.assertCanManage(user, projectId);
    await this.assertUsersExistAndActive([userId]);
    if (await this.access.isMember(projectId, userId)) {
      throw new ConflictException('Người dùng đã là thành viên của dự án');
    }
    await this.prisma.projectMember.create({ data: { projectId, userId } });
    if (userId !== user.id) {
      await this.notifications.notify([
        { userId, type: 'project_added', message: `Bạn được thêm vào dự án "${project.name}"`, link: `/projects/${projectId}` },
      ]);
    }
    return this.get(user, projectId);
  }

  async removeMember(user: AuthUser, projectId: number, userId: number) {
    const project = await this.access.assertCanManage(user, projectId);
    if (userId === project.createdById) {
      throw new BadRequestException('Không thể xóa người tạo dự án khỏi danh sách thành viên');
    }
    const exists = await this.access.isMember(projectId, userId);
    if (!exists) throw new BadRequestException('Người dùng không thuộc dự án');

    await this.prisma.$transaction(async (tx) => {
      // Gỡ người này khỏi danh sách người được giao của mọi task trong dự án (task vẫn giữ những người khác)
      const assigned = await tx.taskAssignee.findMany({ where: { userId, task: { projectId } }, select: { taskId: true } });
      if (assigned.length > 0) {
        const removedUser = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
        await tx.taskAssignee.deleteMany({ where: { userId, task: { projectId } } });
        for (const { taskId } of assigned) {
          await this.activity.log(
            {
              taskId,
              userId: user.id,
              action: 'assignee_changed',
              detail: { added: [], removed: removedUser ? [removedUser] : [], reason: 'removed_from_project' },
            },
            tx,
          );
        }
      }
      await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    });
    return this.get(user, projectId);
  }

  private assertDateRange(start?: string | null, end?: string | null): void {
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
      throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    }
  }

  private async assertUsersExistAndActive(userIds: number[]): Promise<void> {
    if (userIds.length === 0) return;
    const found = await this.prisma.user.count({ where: { id: { in: userIds }, isActive: true } });
    if (found !== userIds.length) throw new BadRequestException('Có người dùng không tồn tại hoặc đã bị vô hiệu hóa');
  }

  /** Đếm task cấp cao (không tính subtask) theo từng dự án */
  private async countsFor(projectIds: number[]): Promise<Map<number, ProjectCounts>> {
    const result = new Map<number, ProjectCounts>();
    if (projectIds.length === 0) return result;
    for (const id of projectIds) result.set(id, { taskCount: 0, doneCount: 0, overdueCount: 0 });

    // Epic chỉ là nhóm story nên không tính vào tiến độ
    const countable: Prisma.TaskWhereInput = { projectId: { in: projectIds }, parentId: null, type: { not: 'epic' } };
    const [byStatus, overdue] = await Promise.all([
      this.prisma.task.groupBy({ by: ['projectId', 'statusId'], where: countable, _count: { _all: true } }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: { ...countable, status: { category: { not: 'done' } }, deadline: { lt: new Date() } },
        _count: { _all: true },
      }),
    ]);
    const statusRows = await this.prisma.projectStatus.findMany({ where: { id: { in: [...new Set(byStatus.map((r) => r.statusId))] } }, select: { id: true, category: true } });
    const categoryOf = new Map(statusRows.map((s) => [s.id, s.category]));
    for (const row of byStatus) {
      const entry = result.get(row.projectId);
      if (!entry) continue;
      entry.taskCount += row._count._all;
      if (categoryOf.get(row.statusId) === 'done') entry.doneCount += row._count._all;
    }
    for (const row of overdue) {
      const entry = result.get(row.projectId);
      if (entry) entry.overdueCount = row._count._all;
    }
    return result;
  }

  private toView(project: ProjectWithRelations, counts: ProjectCounts = { taskCount: 0, doneCount: 0, overdueCount: 0 }) {
    // Webhook là bí mật: chỉ cho biết đã cấu hình hay chưa
    const { members, slackWebhookUrl, ...rest } = project;
    return {
      ...rest,
      slackConfigured: slackWebhookUrl !== null,
      members: members.map((m) => m.user),
      ...counts,
      progress: counts.taskCount === 0 ? 0 : Math.round((counts.doneCount / counts.taskCount) * 100),
    };
  }
}
