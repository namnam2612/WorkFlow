import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { parseDurationToSeconds } from '../common/utils/duration';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload } from './strategies/jwt.strategy';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  jobTitle: string | null;
  phone: string | null;
  contactEmail: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: PublicUser;
}

interface RefreshTokenPayload {
  sub: number;
  jti: string;
}

// Hash giả để so sánh khi không tìm thấy email (chống dò email qua thời gian phản hồi)
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.3Jv1mR3d7sWk1gVfJYb6JzD3zVhe';

@Injectable()
export class AuthService {
  private readonly accessExpiresSeconds: number;
  private readonly refreshExpiresSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessExpiresSeconds = parseDurationToSeconds(config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m');
    this.refreshExpiresSeconds = parseDurationToSeconds(config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d');
  }

  static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt,
      jobTitle: user.jobTitle,
      phone: user.phone,
      contactEmail: user.contactEmail,
      bio: user.bio,
      githubUrl: user.githubUrl,
      linkedinUrl: user.linkedinUrl,
      facebookUrl: user.facebookUrl,
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: AuthService.toPublicUser(user) };
  }

  /** Đăng ký công khai: luôn tạo member, đăng nhập luôn sau khi tạo */
  async register(name: string, email: string, password: string): Promise<LoginResult> {
    if (this.config.get<string>('ALLOW_REGISTRATION') === 'false') {
      throw new ForbiddenException('Hệ thống đang tắt đăng ký tài khoản mới');
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email đã được sử dụng');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({ data: { name, email, passwordHash, role: 'member' } });
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: AuthService.toPublicUser(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(refreshToken) } });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    if (stored.revokedAt) {
      // Token đã bị thu hồi mà vẫn được dùng lại => nghi ngờ bị đánh cắp, thu hồi toàn bộ phiên
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token đã bị thu hồi, vui lòng đăng nhập lại');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị vô hiệu hóa');
    }

    // Rotate: thu hồi token cũ (updateMany + điều kiện để chống race), cấp cặp mới
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedException('Refresh token đã được sử dụng');
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: number): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return AuthService.toPublicUser(user);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    if (currentPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Đổi mật khẩu => đăng xuất mọi thiết bị
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  private async issueTokens(user: Pick<User, 'id' | 'role'>): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = { sub: user.id, role: user.role };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessExpiresSeconds,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshExpiresSeconds,
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshExpiresSeconds * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
