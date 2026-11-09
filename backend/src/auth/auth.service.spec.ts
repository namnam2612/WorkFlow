import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { AuthService } from './auth.service';

const ACCESS_SECRET = 'a'.repeat(32);
const REFRESH_SECRET = 'b'.repeat(32);
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    name: 'Nguyễn Văn An',
    email: 'an@taskflow.vn',
    passwordHash: bcrypt.hashSync('Password123!', 4),
    role: Role.leader,
    avatarUrl: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let prisma: PrismaMock;
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = new JwtService();
    const config = new ConfigService({
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    });
    service = new AuthService(asPrisma(prisma), jwt, config);
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('login', () => {
    it('trả về token đúng thời hạn và user không lộ passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.login('an@taskflow.vn', 'Password123!');

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('an@taskflow.vn');
      const access = jwt.verify<{ sub: number; role: Role; exp: number; iat: number }>(result.accessToken, { secret: ACCESS_SECRET });
      expect(access.sub).toBe(7);
      expect(access.role).toBe('leader');
      expect(access.exp - access.iat).toBe(15 * 60);
      const refresh = jwt.verify<{ sub: number; exp: number; iat: number }>(result.refreshToken, { secret: REFRESH_SECRET });
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
    });

    it('chỉ lưu hash của refresh token, không lưu token thô', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.login('an@taskflow.vn', 'Password123!');

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const arg = callArg(prisma.refreshToken.create, 0) as { data: { tokenHash: string; userId: number } };
      expect(arg.data.tokenHash).toBe(sha256(result.refreshToken));
      expect(arg.data.tokenHash).not.toBe(result.refreshToken);
      expect(arg.data.userId).toBe(7);
    });

    it('từ chối mật khẩu sai', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      await expect(service.login('an@taskflow.vn', 'sai-mat-khau')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('thông báo lỗi giống nhau cho sai mật khẩu và email không tồn tại (không lộ email nào có tài khoản)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(buildUser());
      await expect(service.login('an@taskflow.vn', 'sai')).rejects.toThrow('Email hoặc mật khẩu không đúng');
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.login('khong-ton-tai@taskflow.vn', 'x')).rejects.toThrow('Email hoặc mật khẩu không đúng');
    });

    it('từ chối tài khoản đã bị vô hiệu hóa dù mật khẩu đúng', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      await expect(service.login('an@taskflow.vn', 'Password123!')).rejects.toThrow('vô hiệu hóa');
    });
  });

  describe('refresh', () => {
    async function issueRefreshToken(): Promise<string> {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      const { refreshToken } = await service.login('an@taskflow.vn', 'Password123!');
      prisma.refreshToken.create.mockClear();
      return refreshToken;
    }

    const storedRecord = (token: string, overrides: Record<string, unknown> = {}) => ({
      id: 11,
      userId: 7,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: null,
      ...overrides,
    });

    it('xoay vòng: thu hồi token cũ và cấp cặp token mới', async () => {
      const token = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(storedRecord(token));
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.refresh(token);

      expect(result.refreshToken).not.toBe(token);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { id: 11, revokedAt: null }, data: { revokedAt: expect.any(Date) as Date } });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('phát hiện dùng lại token đã thu hồi => thu hồi toàn bộ phiên của user', async () => {
      const token = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(storedRecord(token, { revokedAt: new Date() }));

      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: 7, revokedAt: null }, data: { revokedAt: expect.any(Date) as Date } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('từ chối token không có trong DB', async () => {
      const token = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối token đã hết hạn trong DB', async () => {
      const token = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(storedRecord(token, { expiresAt: new Date(Date.now() - 1000) }));
      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối chuỗi rác và token ký bằng secret khác (vd. access token)', async () => {
      await expect(service.refresh('khong-phai-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
      const accessToken = jwt.sign({ sub: 7, jti: 'x' }, { secret: ACCESS_SECRET });
      await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi user đã bị vô hiệu hóa sau khi cấp token', async () => {
      const token = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(storedRecord(token));
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi hai request refresh song song (chỉ một request được thu hồi thành công)', async () => {
      const token = await issueRefreshToken();
      prisma.refreshToken.findUnique.mockResolvedValue(storedRecord(token));
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('thu hồi refresh token theo hash', async () => {
      await service.logout('some-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('some-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('changePassword', () => {
    it('từ chối khi mật khẩu hiện tại sai', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      await expect(service.changePassword(7, 'sai', 'MatKhauMoi123')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('từ chối khi mật khẩu mới trùng mật khẩu cũ', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      await expect(service.changePassword(7, 'Password123!', 'Password123!')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('đổi thành công: lưu hash mới và đăng xuất mọi thiết bị', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue({});

      await service.changePassword(7, 'Password123!', 'MatKhauMoi123');

      const arg = callArg(prisma.user.update, 0) as { data: { passwordHash: string } };
      expect(await bcrypt.compare('MatKhauMoi123', arg.data.passwordHash)).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: 7, revokedAt: null }, data: { revokedAt: expect.any(Date) as Date } });
    });
  });
});
