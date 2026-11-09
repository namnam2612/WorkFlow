import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService, PublicUser } from '../auth/auth.service';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type StatusCounts = Record<TaskStatus, number>;

export interface UserStats {
  counts: StatusCounts;
  overdue: number;
  total: number;
}

const emptyCounts = (): StatusCounts => ({ todo: 0, in_progress: 0, review: 0, done: 0, blocked: 0 });

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async list(user: AuthUser, query: ListUsersQueryDto): Promise<Paginated<PublicUser & { stats: UserStats }>> {
    const filters: Prisma.UserWhereInput[] = [];
    if (query.search) {
      filters.push({ OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] });
    }
    if (query.role) filters.push({ role: query.role });

    if (user.role === 'admin') {
      if (query.isActive !== undefined) filters.push({ isActive: query.isActive });
    } else {
      filters.push({ isActive: true });
      // Chỉ thấy người cùng dự án (và chính mình)
      if (user.role === 'member') {
        filters.push({
          OR: [{ id: user.id }, { memberships: { some: { project: { members: { some: { userId: user.id } } } } } }],
        });
      }
    }
    const where: Prisma.UserWhereInput = { AND: filters };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    const stats = await this.statsFor(
      users.map((u) => u.id),
      user,
    );
    const items = users.map((u) => ({ ...AuthService.toPublicUser(u), stats: stats.get(u.id) ?? this.emptyStats() }));
    return toPaginated(items, total, query.page, query.pageSize);
  }

  async get(viewer: AuthUser, id: number): Promise<PublicUser & { stats: UserStats }> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    if (viewer.role === 'member' && viewer.id !== id) {
      const shared = await this.prisma.projectMember.findFirst({
        where: { userId: id, project: { members: { some: { userId: viewer.id } } } },
        select: { userId: true },
      });
      if (!shared) throw new ForbiddenException('Bạn không có quyền xem người dùng này');
    }
    const stats = await this.statsFor([id], viewer);
    return { ...AuthService.toPublicUser(target), stats: stats.get(id) ?? this.emptyStats() };
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email đã được sử dụng');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, role: dto.role, passwordHash },
    });
    return AuthService.toPublicUser(user);
  }

  async update(actor: AuthUser, id: number, dto: UpdateUserDto): Promise<PublicUser> {
    const isAdmin = actor.role === 'admin';
    if (!isAdmin && actor.id !== id) throw new ForbiddenException('Bạn chỉ được sửa thông tin của chính mình');
    if (!isAdmin && (dto.role !== undefined || dto.isActive !== undefined || dto.password !== undefined)) {
      throw new ForbiddenException('Chỉ quản trị viên được đổi vai trò, trạng thái hoặc đặt lại mật khẩu');
    }
    if (isAdmin && actor.id === id && (dto.role !== undefined || dto.isActive !== undefined)) {
      throw new BadRequestException('Không thể tự đổi vai trò hoặc vô hiệu hóa chính mình');
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');

    const data: Prisma.UserUpdateInput = {
      name: dto.name,
      avatarUrl: dto.avatarUrl,
      role: dto.role,
      isActive: dto.isActive,
    };
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);

    const revokeSessions = dto.isActive === false || dto.password !== undefined || (dto.role !== undefined && dto.role !== target.role);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({ where: { id }, data });
      // Vô hiệu hóa / đổi mật khẩu / đổi vai trò => buộc đăng nhập lại
      if (revokeSessions) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return result;
    });
    return AuthService.toPublicUser(updated);
  }

  /** Thống kê task cấp cao theo trạng thái + quá hạn; chỉ tính trong các dự án người xem được phép thấy */
  async statsFor(userIds: number[], viewer: AuthUser): Promise<Map<number, UserStats>> {
    const result = new Map<number, UserStats>();
    if (userIds.length === 0) return result;
    for (const id of userIds) result.set(id, this.emptyStats());

    const visibleProjectIds = await this.access.visibleProjectIds(viewer);
    const scope: Prisma.TaskWhereInput = {
      assigneeId: { in: userIds },
      parentId: null,
      ...(visibleProjectIds ? { projectId: { in: visibleProjectIds } } : {}),
    };

    const [byStatus, overdue] = await Promise.all([
      this.prisma.task.groupBy({ by: ['assigneeId', 'status'], where: scope, _count: { _all: true } }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { ...scope, status: { not: 'done' }, deadline: { lt: new Date() } },
        _count: { _all: true },
      }),
    ]);
    for (const row of byStatus) {
      if (row.assigneeId === null) continue;
      const entry = result.get(row.assigneeId);
      if (!entry) continue;
      entry.counts[row.status] = row._count._all;
      entry.total += row._count._all;
    }
    for (const row of overdue) {
      if (row.assigneeId === null) continue;
      const entry = result.get(row.assigneeId);
      if (entry) entry.overdue = row._count._all;
    }
    return result;
  }

  private emptyStats(): UserStats {
    return { counts: emptyCounts(), overdue: 0, total: 0 };
  }
}
