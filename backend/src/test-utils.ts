import { PrismaService } from './prisma/prisma.service';

type MockFn = jest.Mock;

export interface PrismaMock {
  user: Record<'findUnique' | 'findUniqueOrThrow' | 'update' | 'findMany' | 'create', MockFn>;
  refreshToken: Record<'create' | 'findUnique' | 'updateMany', MockFn>;
  project: Record<'findUnique', MockFn>;
  projectMember: Record<'findUnique', MockFn>;
  task: Record<'findUnique' | 'findMany' | 'create' | 'update' | 'delete' | 'count' | 'aggregate', MockFn>;
  $transaction: MockFn;
}

/** Tạo Prisma giả: mọi phương thức là jest.fn(); $transaction chạy callback với chính mock này */
export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    project: { findUnique: jest.fn() },
    projectMember: { findUnique: jest.fn() },
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: PrismaMock) => unknown)(mock);
    return Promise.all(arg as Promise<unknown>[]);
  });
  return mock;
}

export const asPrisma = (mock: PrismaMock): PrismaService => mock as unknown as PrismaService;

/** Đối số thứ `arg` của lần gọi thứ `call` (kiểu unknown để người dùng tự ép kiểu có chủ đích) */
export function callArg(mock: jest.Mock, call = 0, arg = 0): unknown {
  const calls = mock.mock.calls as unknown[][];
  return calls[call]?.[arg];
}

/** Đối số đầu tiên của mọi lần gọi */
export function firstArgs(mock: jest.Mock): unknown[] {
  const calls = mock.mock.calls as unknown[][];
  return calls.map((c) => c[0]);
}
