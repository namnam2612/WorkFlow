import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class Sample {
  @Roles('admin', 'leader')
  managerOnly(this: void): void {}

  open(this: void): void {}
}

// Phải truyền đúng hàm gốc (bind() sẽ làm mất metadata của @Roles)
function contextFor(handler: () => void, role?: Role): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Sample,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 1, role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('cho qua khi route không yêu cầu vai trò', () => {
    expect(guard.canActivate(contextFor(Sample.prototype.open, 'member'))).toBe(true);
  });

  it.each<Role>(['admin', 'leader'])('cho phép %s vào route quản lý', (role) => {
    expect(guard.canActivate(contextFor(Sample.prototype.managerOnly, role))).toBe(true);
  });

  it('chặn member vào route quản lý', () => {
    const ctx = contextFor(Sample.prototype.managerOnly, 'member');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('chặn khi chưa có user', () => {
    expect(() => guard.canActivate(contextFor(Sample.prototype.managerOnly))).toThrow(ForbiddenException);
  });
});
