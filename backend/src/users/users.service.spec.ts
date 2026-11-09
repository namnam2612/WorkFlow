import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../test-utils';
import { UpdateUserDto } from './dto/update-user.dto';
import { detectImageMime, MAX_AVATAR_BYTES, UsersService } from './users.service';

const admin: AuthUser = { id: 1, email: 'admin@x.vn', name: 'Admin', role: 'admin' };
const leader: AuthUser = { id: 2, email: 'l@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 3, email: 'm@x.vn', name: 'Member', role: 'member' };

const target = (id: number, role: Role = 'member'): User => ({
  id,
  name: `User ${id}`,
  email: `u${id}@x.vn`,
  passwordHash: 'hash',
  role,
  avatarUrl: null,
  isActive: true,
  emailNotifications: false,
  createdAt: new Date(),
  jobTitle: null,
  phone: null,
  contactEmail: null,
  bio: null,
  githubUrl: null,
  linkedinUrl: null,
  facebookUrl: null,
});

describe('UsersService - phân quyền', () => {
  let prisma: PrismaMock;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const prismaService = asPrisma(prisma);
    service = new UsersService(prismaService, new ProjectAccessService(prismaService));
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(target(where.id)));
    prisma.user.update.mockImplementation(({ where, data }: { where: { id: number }; data: Partial<User> }) =>
      Promise.resolve({ ...target(where.id), ...data }),
    );
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('member không sửa được thông tin người khác', async () => {
    await expect(service.update(member, 9, { name: 'Hack' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('leader không sửa được người khác', async () => {
    await expect(service.update(leader, 9, { name: 'Hack' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['role', { role: 'admin' as Role }],
    ['isActive', { isActive: false }],
    ['password', { password: 'MatKhauMoi123' }],
  ])('member không tự nâng quyền/đổi %s của chính mình', async (_name, dto) => {
    await expect(service.update(member, member.id, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('member tự đổi tên được', async () => {
    const result = await service.update(member, member.id, { name: 'Tên mới' });
    expect(result.name).toBe('Tên mới');
  });

  it('admin không thể tự hạ vai trò hoặc tự vô hiệu hóa (tránh khóa hệ thống)', async () => {
    await expect(service.update(admin, admin.id, { role: 'member' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(admin, admin.id, { isActive: false })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('admin vô hiệu hóa người khác => thu hồi mọi refresh token của họ', async () => {
    await service.update(admin, 9, { isActive: false });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: 9, revokedAt: null }, data: { revokedAt: expect.any(Date) as Date } });
  });

  it('admin đổi vai trò người khác => buộc đăng nhập lại; chỉ đổi tên thì không', async () => {
    await service.update(admin, 9, { role: 'leader' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    prisma.refreshToken.updateMany.mockClear();
    await service.update(admin, 9, { name: 'Chỉ đổi tên' });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('404 khi người dùng không tồn tại', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.update(admin, 404, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('member không xem được hồ sơ người không chung dự án', async () => {
    // projectMember.findUnique không dùng ở đây; service dùng findFirst nên bổ sung vào mock
    (prisma.projectMember as unknown as Record<string, jest.Mock>).findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.get(member, 9)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

describe('UsersService - hồ sơ và ảnh đại diện', () => {
  let prisma: PrismaMock;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const prismaService = asPrisma(prisma);
    service = new UsersService(prismaService, new ProjectAccessService(prismaService));
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(target(where.id)));
    prisma.user.update.mockImplementation(({ where, data }: { where: { id: number }; data: Partial<User> }) =>
      Promise.resolve({ ...target(where.id), ...data }),
    );
    prisma.userAvatar.upsert.mockResolvedValue({});
    prisma.userAvatar.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('member tự cập nhật hồ sơ (điện thoại, GitHub, email liên hệ...)', async () => {
    const result = await service.update(member, member.id, {
      phone: '0901 234 567',
      githubUrl: 'https://github.com/abc',
      contactEmail: 'abc@gmail.com',
      jobTitle: 'Lập trình viên',
      bio: 'Xin chào',
    });
    expect(result).toMatchObject({ phone: '0901 234 567', githubUrl: 'https://github.com/abc', contactEmail: 'abc@gmail.com', jobTitle: 'Lập trình viên', bio: 'Xin chào' });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('member không sửa hồ sơ người khác', async () => {
    await expect(service.update(member, 9, { phone: '0901234567' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('tải ảnh đại diện: lưu ảnh và đặt avatarUrl trỏ về API', async () => {
    const result = await service.setAvatar(member, member.id, { buffer: PNG });
    expect(prisma.userAvatar.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: member.id } }));
    expect(result.avatarUrl).toMatch(new RegExp(`^/api/users/${member.id}/avatar\\?v=\\d+$`));
  });

  it('admin đổi được ảnh của người khác; member/leader thì không', async () => {
    await expect(service.setAvatar(admin, 9, { buffer: JPEG })).resolves.toBeDefined();
    await expect(service.setAvatar(member, 9, { buffer: JPEG })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setAvatar(leader, 9, { buffer: JPEG })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeAvatar(member, 9)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('từ chối tệp không phải ảnh (dù đặt tên .png), tệp rỗng, tệp quá lớn', async () => {
    await expect(service.setAvatar(member, member.id, { buffer: Buffer.from('<svg onload=alert(1)>') })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setAvatar(member, member.id, { buffer: Buffer.alloc(0) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setAvatar(member, member.id, undefined)).rejects.toBeInstanceOf(BadRequestException);
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_AVATAR_BYTES)]);
    await expect(service.setAvatar(member, member.id, { buffer: big })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userAvatar.upsert).not.toHaveBeenCalled();
  });

  it('xóa ảnh đại diện đặt avatarUrl về null', async () => {
    const result = await service.removeAvatar(member, member.id);
    expect(prisma.userAvatar.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
    expect(result.avatarUrl).toBeNull();
  });

  it('getAvatar 404 khi chưa có ảnh', async () => {
    prisma.userAvatar.findUnique.mockResolvedValue(null);
    await expect(service.getAvatar(3)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('nhận diện đúng JPEG/PNG/WebP và từ chối định dạng khác', () => {
    expect(detectImageMime(JPEG)).toBe('image/jpeg');
    expect(detectImageMime(PNG)).toBe('image/png');
    expect(detectImageMime(WEBP)).toBe('image/webp');
    expect(detectImageMime(Buffer.from('GIF89a....'))).toBeNull();
  });
});

describe('UpdateUserDto - kiểm tra hồ sơ', () => {
  const errorsFor = async (input: Record<string, unknown>): Promise<string[]> =>
    (await validate(plainToInstance(UpdateUserDto, input))).map((e) => e.property);

  it('chấp nhận dữ liệu hợp lệ và chuỗi rỗng (xóa trường)', async () => {
    expect(await errorsFor({ phone: '+84 901 234 567', githubUrl: 'https://github.com/abc', linkedinUrl: 'https://www.linkedin.com/in/abc', facebookUrl: 'https://facebook.com/abc', contactEmail: 'a@gmail.com' })).toEqual([]);
    expect(await errorsFor({ phone: '  ', githubUrl: '', contactEmail: '' })).toEqual([]);
  });

  it.each([
    ['phone', 'abc123'],
    ['phone', '12'],
    ['githubUrl', 'https://evil.com/github.com'],
    ['githubUrl', 'javascript:alert(1)'],
    ['githubUrl', 'github.com/abc'],
    ['linkedinUrl', 'https://github.com/abc'],
    ['facebookUrl', 'https://example.com/fb'],
    ['contactEmail', 'khong-phai-email'],
    ['bio', 'x'.repeat(501)],
  ])('từ chối %s = %s', async (field, value) => {
    expect(await errorsFor({ [field]: value })).toContain(field);
  });
});
