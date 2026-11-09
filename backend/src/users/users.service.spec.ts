import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../test-utils';
import { UsersService } from './users.service';

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
  createdAt: new Date(),
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
