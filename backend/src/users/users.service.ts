import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService, PublicUser } from '../auth/auth.service';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { assigneeStats, CategoryCounts, emptyCategoryCounts } from '../tasks/assignee-stats';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type StatusCounts = CategoryCounts;

export interface UserStats {
  counts: StatusCounts;
  overdue: number;
  total: number;
}

export const MAX_AVATAR_BYTES = 1024 * 1024;

/** Nhận diện JPEG/PNG/WebP qua chữ ký (magic bytes) */
export function detectImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const emptyCounts = emptyCategoryCounts;

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
      jobTitle: dto.jobTitle,
      phone: dto.phone,
      contactEmail: dto.contactEmail,
      bio: dto.bio,
      githubUrl: dto.githubUrl,
      linkedinUrl: dto.linkedinUrl,
      facebookUrl: dto.facebookUrl,
      role: dto.role,
      isActive: dto.isActive,
      emailNotifications: dto.emailNotifications,
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

  /** Tải ảnh đại diện (chỉ chính chủ hoặc admin). Kiểm tra định dạng bằng chữ ký file, không tin Content-Type do client gửi. */
  async setAvatar(actor: AuthUser, id: number, file: { buffer: Buffer } | undefined): Promise<PublicUser> {
    this.assertCanEditAvatar(actor, id);
    if (!file || file.buffer.length === 0) throw new BadRequestException('Vui lòng chọn ảnh');
    if (file.buffer.length > MAX_AVATAR_BYTES) throw new BadRequestException('Ảnh quá lớn (tối đa 1MB)');
    const mime = detectImageMime(file.buffer);
    if (!mime) throw new BadRequestException('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP');
    if (!(await this.prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Không tìm thấy người dùng');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userAvatar.upsert({
        where: { userId: id },
        create: { userId: id, mime, data: Uint8Array.from(file.buffer) },
        update: { mime, data: Uint8Array.from(file.buffer) },
      });
      // ?v= đổi theo mỗi lần tải lên để trình duyệt không dùng ảnh cũ trong cache
      return tx.user.update({ where: { id }, data: { avatarUrl: `/api/users/${id}/avatar?v=${Date.now()}` } });
    });
    return AuthService.toPublicUser(updated);
  }

  async removeAvatar(actor: AuthUser, id: number): Promise<PublicUser> {
    this.assertCanEditAvatar(actor, id);
    if (!(await this.prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Không tìm thấy người dùng');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userAvatar.deleteMany({ where: { userId: id } });
      return tx.user.update({ where: { id }, data: { avatarUrl: null } });
    });
    return AuthService.toPublicUser(updated);
  }

  async getAvatar(id: number): Promise<{ mime: string; data: Buffer }> {
    const avatar = await this.prisma.userAvatar.findUnique({ where: { userId: id } });
    if (!avatar) throw new NotFoundException('Không có ảnh đại diện');
    return { mime: avatar.mime, data: Buffer.from(avatar.data) };
  }

  private assertCanEditAvatar(actor: AuthUser, id: number): void {
    if (actor.role !== 'admin' && actor.id !== id) throw new ForbiddenException('Bạn chỉ được đổi ảnh đại diện của chính mình');
  }

  /** Thống kê task cấp cao theo trạng thái + quá hạn; chỉ tính trong các dự án người xem được phép thấy */
  async statsFor(userIds: number[], viewer: AuthUser): Promise<Map<number, UserStats>> {
    const result = new Map<number, UserStats>();
    if (userIds.length === 0) return result;
    for (const id of userIds) result.set(id, this.emptyStats());

    const visibleProjectIds = await this.access.visibleProjectIds(viewer);
    // Task cấp cao trong các dự án người xem được thấy; task giao cho nhiều người được tính cho từng người
    const task: Prisma.TaskWhereInput = { parentId: null, ...(visibleProjectIds ? { projectId: { in: visibleProjectIds } } : {}) };
    const stats = await assigneeStats(this.prisma, { userId: { in: userIds }, task });
    for (const [userId, stat] of stats) {
      const entry = result.get(userId);
      if (!entry) continue;
      entry.counts = stat.counts;
      entry.overdue = stat.overdue;
      entry.total = Object.values(stat.counts).reduce((sum, n) => sum + n, 0);
    }
    return result;
  }

  private emptyStats(): UserStats {
    return { counts: emptyCounts(), overdue: 0, total: 0 };
  }
}
