/**
 * Diễn tập migration `task_assignees` trên một DB TẠM (KHÔNG dùng DB thật):
 *   1. áp dụng mọi migration TRƯỚC `task_assignees` (schema cũ, có Task.assigneeId)
 *   2. nạp dữ liệu cũ: task có người thực hiện, task chưa giao, công việc con, task đã done
 *   3. áp dụng `task_assignees`
 *   4. kiểm tra: mỗi task có assigneeId cũ có đúng 1 dòng TaskAssignee, task chưa giao không có dòng nào,
 *      cột assigneeId đã bị xóa, xóa task/user thì dòng nối tự xóa theo (CASCADE), và chạy lại không lỗi.
 *
 * Chạy:  VERIFY_DATABASE_URL="mysql://user:pass@localhost:3307/taskflow_migtest" npm run verify:assignee-migration
 * (DB phải tồn tại và RỖNG; script sẽ xóa sạch bảng của nó ở đầu để chạy lại được.)
 */
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const url = process.env.VERIFY_DATABASE_URL;
if (!url) throw new Error('Thiếu VERIFY_DATABASE_URL (một DB tạm, KHÔNG phải DB thật)');
if (!/(test|tmp|verify|scratch|mig)/i.test(url.split('/').pop() ?? '')) {
  throw new Error('Tên DB phải chứa test/tmp/verify/scratch/mig để tránh chạy nhầm lên DB thật');
}

const prismaDir = resolve(__dirname, '../prisma');
const migrationsDir = join(prismaDir, 'migrations');
const TARGET = 'task_assignees';
const target = readdirSync(migrationsDir).find((name) => name.endsWith(`_${TARGET}`));
if (!target) throw new Error(`Không tìm thấy migration *_${TARGET}`);

const env = { ...process.env, DATABASE_URL: url };
const prisma = (args: string[], schema: string) => execFileSync('npx', ['prisma', ...args, '--schema', schema], { env, stdio: 'pipe', cwd: resolve(__dirname, '..') }).toString();

async function main(): Promise<void> {
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    // Bắt đầu từ DB sạch
    await client.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    const tables = await client.$queryRawUnsafe<{ TABLE_NAME: string }[]>('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()');
    for (const t of tables) await client.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${t.TABLE_NAME}\``);
    await client.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

    // 1) Chỉ các migration TRƯỚC migration đích
    const tmp = mkdtempSync(join(tmpdir(), 'mig-'));
    mkdirSync(join(tmp, 'migrations'));
    for (const name of readdirSync(migrationsDir)) {
      if (name >= target!) continue;
      cpSync(join(migrationsDir, name), join(tmp, 'migrations', name), { recursive: true });
    }
    if (existsSync(join(migrationsDir, 'migration_lock.toml'))) cpSync(join(migrationsDir, 'migration_lock.toml'), join(tmp, 'migrations', 'migration_lock.toml'));
    cpSync(join(prismaDir, 'schema.prisma'), join(tmp, 'schema.prisma'));
    prisma(['migrate', 'deploy'], join(tmp, 'schema.prisma'));
    rmSync(tmp, { recursive: true, force: true });
    console.log('1) Đã áp dụng các migration trước', target);

    // 2) Dữ liệu cũ (schema cũ: Task.assigneeId)
    await client.$executeRawUnsafe(`INSERT INTO User (id, name, email, passwordHash, role, isActive) VALUES
      (1, 'Leader', 'l@x.vn', 'x', 'leader', 1), (2, 'Cuong', 'c@x.vn', 'x', 'member', 1), (3, 'Dung', 'd@x.vn', 'x', 'member', 1)`);
    await client.$executeRawUnsafe(`INSERT INTO Project (id, name, createdById) VALUES (1, 'P', 1)`);
    await client.$executeRawUnsafe(`INSERT INTO Task (id, projectId, parentId, title, assigneeId, creatorId, status, priority, position, updatedAt, createdAt) VALUES
      (1, 1, NULL, 'Giao Cuong', 2, 1, 'todo', 'medium', 0, NOW(3), '2026-01-01 10:00:00.000'),
      (2, 1, NULL, 'Giao Dung', 3, 1, 'done', 'high', 0, NOW(3), '2026-02-01 10:00:00.000'),
      (3, 1, NULL, 'Chua giao', NULL, 1, 'todo', 'low', 1, NOW(3), NOW(3)),
      (4, 1, 1, 'Viec con cua Cuong', 2, 2, 'todo', 'medium', 0, NOW(3), NOW(3)),
      (5, 1, NULL, 'Cuong lan nua', 2, 1, 'in_progress', 'medium', 0, NOW(3), NOW(3))`);
    const before = await client.$queryRawUnsafe<{ n: bigint }[]>('SELECT COUNT(*) AS n FROM Task WHERE assigneeId IS NOT NULL');
    console.log('2) Dữ liệu cũ: task có người thực hiện =', Number(before[0].n));

    // 3) Áp dụng toàn bộ migration (gồm migration đích)
    prisma(['migrate', 'deploy'], join(prismaDir, 'schema.prisma'));
    console.log('3) Đã áp dụng', target);

    // 4) Kiểm tra
    const rows = await client.$queryRawUnsafe<{ taskId: number; userId: number; assignedAt: Date }[]>('SELECT taskId, userId, assignedAt FROM TaskAssignee ORDER BY taskId');
    const pairs = rows.map((r) => `${r.taskId}:${r.userId}`).join(',');
    const expected = '1:2,2:3,4:2,5:2';
    if (pairs !== expected) throw new Error(`Dữ liệu sau migration sai: ${pairs} (mong ${expected})`);
    if (rows.length !== Number(before[0].n)) throw new Error('Số dòng TaskAssignee không bằng số task có người thực hiện trước đó');
    if (rows.find((r) => r.taskId === 3)) throw new Error('Task chưa giao không được có dòng TaskAssignee');
    if (rows.find((r) => r.taskId === 1)?.assignedAt.toISOString() !== '2026-01-01T10:00:00.000Z') {
      throw new Error('assignedAt phải lấy từ thời điểm tạo task');
    }
    const cols = await client.$queryRawUnsafe<{ COLUMN_NAME: string }[]>("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'Task' AND column_name = 'assigneeId'");
    if (cols.length !== 0) throw new Error('Cột Task.assigneeId phải bị xóa');
    console.log('4) Dữ liệu chuyển đúng:', pairs, '| cột assigneeId đã xóa');

    // CASCADE: xóa task / user thì dòng nối tự xóa
    await client.$executeRawUnsafe('DELETE FROM Task WHERE id = 5');
    await client.$executeRawUnsafe('DELETE FROM User WHERE id = 3');
    const left = (await client.$queryRawUnsafe<{ taskId: number; userId: number }[]>('SELECT taskId, userId FROM TaskAssignee ORDER BY taskId')).map((r) => `${r.taskId}:${r.userId}`).join(',');
    if (left !== '1:2,4:2') throw new Error(`CASCADE sai: ${left}`);
    console.log('5) CASCADE đúng khi xóa task/user:', left);

    // Chạy lại migrate deploy: không còn gì để áp dụng
    prisma(['migrate', 'deploy'], join(prismaDir, 'schema.prisma'));
    console.log('6) migrate deploy chạy lại không lỗi\nOK — migration an toàn trên dữ liệu có sẵn');
  } finally {
    await client.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('THẤT BẠI:', error instanceof Error ? error.message : error);
  process.exit(1);
});
