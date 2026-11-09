import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Team } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto, UpdateTeamMemberDto } from './dto/team.dto';

const teamInclude = {
  leader: { select: USER_BRIEF_SELECT },
  _count: { select: { members: true, projects: true } },
} satisfies Prisma.TeamInclude;

type TeamRow = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Admin thấy mọi nhóm; người khác thấy nhóm mình là thành viên hoặc trưởng nhóm */
  visibleWhere(user: AuthUser): Prisma.TeamWhereInput {
    if (user.role === 'admin') return {};
    return { OR: [{ leaderId: user.id }, { members: { some: { userId: user.id } } }] };
  }

  canManage(user: AuthUser, team: Pick<Team, 'leaderId'>): boolean {
    return user.role === 'admin' || (user.role === 'leader' && team.leaderId === user.id);
  }

  async list(user: AuthUser) {
    const teams = await this.prisma.team.findMany({ where: this.visibleWhere(user), include: teamInclude, orderBy: { name: 'asc' } });
    return teams.map((t) => this.toSummary(user, t));
  }

  async get(user: AuthUser, id: number) {
    const team = await this.prisma.team.findFirst({ where: { id, ...this.visibleWhere(user) }, include: teamInclude });
    if (!team) throw new NotFoundException('Không tìm thấy nhóm');
    const [members, projects] = await Promise.all([
      this.prisma.teamMember.findMany({ where: { teamId: id }, include: { user: { select: { ...USER_BRIEF_SELECT, email: true, jobTitle: true } } }, orderBy: { joinedAt: 'asc' } }),
      this.prisma.project.findMany({ where: { teamId: id, ...(user.role === 'admin' ? {} : { OR: [{ createdById: user.id }, { members: { some: { userId: user.id } } }] }) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { ...this.toSummary(user, team), members: members.map((m) => ({ ...m.user, specialty: m.specialty, joinedAt: m.joinedAt })), projects };
  }

  async create(user: AuthUser, dto: CreateTeamDto) {
    if (user.role !== 'admin' && user.role !== 'leader') throw new ForbiddenException('Chỉ trưởng nhóm hoặc quản trị viên mới tạo được nhóm');
    if (dto.leaderId !== undefined && dto.leaderId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Chỉ quản trị viên mới chỉ định trưởng nhóm khác');
    }
    const leaderId = dto.leaderId ?? user.id;
    await this.assertLeader(leaderId);
    await this.assertNameFree(dto.name);
    const team = await this.prisma.team.create({
      data: { name: dto.name, description: dto.description ?? null, leaderId, members: { create: [{ userId: leaderId }] } },
      include: teamInclude,
    });
    return this.toSummary(user, team);
  }

  async update(user: AuthUser, id: number, dto: UpdateTeamDto) {
    const team = await this.findOrThrow(id);
    this.assertCanManage(user, team);
    if (dto.leaderId !== undefined && dto.leaderId !== team.leaderId) {
      if (user.role !== 'admin') throw new ForbiddenException('Chỉ quản trị viên mới đổi trưởng nhóm');
      await this.assertLeader(dto.leaderId);
    }
    if (dto.name !== undefined && dto.name !== team.name) await this.assertNameFree(dto.name, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.team.update({ where: { id }, data: { name: dto.name, description: dto.description, leaderId: dto.leaderId }, include: teamInclude });
      // Trưởng nhóm mới luôn là thành viên của nhóm
      if (dto.leaderId !== undefined) await tx.teamMember.upsert({ where: { teamId_userId: { teamId: id, userId: dto.leaderId } }, create: { teamId: id, userId: dto.leaderId }, update: {} });
      return result;
    });
    return this.toSummary(user, updated);
  }

  /** Xóa nhóm: dự án của nhóm không bị xóa, chỉ bỏ liên kết (khóa ngoại SetNull) */
  async remove(user: AuthUser, id: number): Promise<void> {
    this.assertCanManage(user, await this.findOrThrow(id));
    await this.prisma.team.delete({ where: { id } });
  }

  /**
   * Thêm thành viên vào nhóm và đồng thời vào mọi dự án của nhóm (để họ thấy việc ngay).
   * Gỡ khỏi nhóm thì KHÔNG tự gỡ khỏi dự án (người đó có thể đang giữ việc) — leader dự án gỡ tay nếu cần.
   */
  async addMember(user: AuthUser, id: number, dto: AddTeamMemberDto) {
    const team = await this.findOrThrow(id);
    this.assertCanManage(user, team);
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, isActive: true, role: true } });
    if (!target?.isActive) throw new BadRequestException('Người dùng không tồn tại hoặc đã bị vô hiệu hóa');
    if (target.role === 'admin') throw new BadRequestException('Quản trị viên không cần thêm vào nhóm');
    const exists = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: id, userId: dto.userId } } });
    if (exists) throw new ConflictException('Người này đã ở trong nhóm');

    const projects = await this.prisma.project.findMany({ where: { teamId: id }, select: { id: true, name: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.create({ data: { teamId: id, userId: dto.userId, specialty: dto.specialty ?? 'other' } });
      if (projects.length > 0) {
        await tx.projectMember.createMany({ data: projects.map((p) => ({ projectId: p.id, userId: dto.userId })), skipDuplicates: true });
      }
    });
    await this.notifications.notify([
      { userId: dto.userId, type: 'team_added', message: `Bạn được thêm vào nhóm "${team.name}"`, link: `/teams/${id}` },
      ...projects.map((p) => ({ userId: dto.userId, type: 'project_added', message: `Bạn được thêm vào dự án "${p.name}"`, link: `/projects/${p.id}`, projectId: p.id })),
    ]);
    return this.get(user, id);
  }

  async updateMember(user: AuthUser, id: number, userId: number, dto: UpdateTeamMemberDto) {
    this.assertCanManage(user, await this.findOrThrow(id));
    const member = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: id, userId } } });
    if (!member) throw new NotFoundException('Người này không thuộc nhóm');
    await this.prisma.teamMember.update({ where: { teamId_userId: { teamId: id, userId } }, data: { specialty: dto.specialty } });
    return this.get(user, id);
  }

  async removeMember(user: AuthUser, id: number, userId: number) {
    const team = await this.findOrThrow(id);
    this.assertCanManage(user, team);
    if (userId === team.leaderId) throw new BadRequestException('Không thể gỡ trưởng nhóm; hãy đổi trưởng nhóm trước');
    const member = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: id, userId } } });
    if (!member) throw new NotFoundException('Người này không thuộc nhóm');
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId: id, userId } } });
    return this.get(user, id);
  }

  // ---------------------------------------------------------------- helpers

  private toSummary(user: AuthUser, team: TeamRow) {
    const { _count, ...rest } = team;
    return { ...rest, memberCount: _count.members, projectCount: _count.projects, canManage: this.canManage(user, team) };
  }

  private assertCanManage(user: AuthUser, team: Pick<Team, 'leaderId'>): void {
    if (!this.canManage(user, team)) throw new ForbiddenException('Chỉ trưởng nhóm hoặc quản trị viên mới có quyền này');
  }

  private async findOrThrow(id: number): Promise<Team> {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Không tìm thấy nhóm');
    return team;
  }

  private async assertLeader(userId: number): Promise<void> {
    const leader = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true } });
    if (!leader?.isActive) throw new BadRequestException('Trưởng nhóm không tồn tại hoặc đã bị vô hiệu hóa');
    if (leader.role === 'member') throw new BadRequestException('Trưởng nhóm phải có vai trò Trưởng nhóm hoặc Quản trị viên');
  }

  private async assertNameFree(name: string, exceptId?: number): Promise<void> {
    const dup = await this.prisma.team.findFirst({ where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (dup) throw new ConflictException(`Đã có nhóm tên "${name}"`);
  }
}
