import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Kiểm tra tĩnh migration `task_assignees` (thứ tự các bước quyết định việc có mất dữ liệu hay không).
 * Chạy thật trên MySQL với dữ liệu cũ: `npm run verify:assignee-migration` (xem scripts/verify-assignee-migration.ts).
 */
describe('migration task_assignees', () => {
  const dir = join(__dirname, '../../prisma/migrations');
  const folder = readdirSync(dir).find((name) => name.endsWith('_task_assignees'));
  const sql = folder ? readFileSync(join(dir, folder, 'migration.sql'), 'utf8') : '';
  const at = (needle: RegExp): number => sql.search(needle);

  it('tồn tại', () => {
    expect(folder).toBeDefined();
  });

  it('tạo bảng TaskAssignee với khóa chính kép (taskId, userId) và index theo userId', () => {
    expect(sql).toMatch(/CREATE TABLE `TaskAssignee`/);
    expect(sql).toMatch(/PRIMARY KEY \(`taskId`, `userId`\)/);
    expect(sql).toMatch(/INDEX `TaskAssignee_userId_idx`\(`userId`\)/);
  });

  it('khóa ngoại tới Task và User đều ON DELETE CASCADE', () => {
    expect(sql).toMatch(/TaskAssignee_taskId_fkey.*REFERENCES `Task`\(`id`\) ON DELETE CASCADE/);
    expect(sql).toMatch(/TaskAssignee_userId_fkey.*REFERENCES `User`\(`id`\) ON DELETE CASCADE/);
  });

  it('sao chép assigneeId cũ sang TaskAssignee (chỉ task có người thực hiện)', () => {
    expect(sql).toMatch(/INSERT (IGNORE )?INTO `TaskAssignee`[\s\S]*SELECT `id`, `assigneeId`, `createdAt`\s+FROM `Task`\s+WHERE `assigneeId` IS NOT NULL/);
  });

  it('THỨ TỰ: tạo bảng -> sao chép dữ liệu -> mới xóa khóa ngoại/index/cột cũ', () => {
    const create = at(/CREATE TABLE `TaskAssignee`/);
    const copy = at(/INSERT (IGNORE )?INTO `TaskAssignee`/);
    const dropFk = at(/DROP FOREIGN KEY `Task_assigneeId_fkey`/);
    const dropIndex = at(/DROP INDEX `Task_assigneeId_status_idx`/);
    const dropColumn = at(/DROP COLUMN `assigneeId`/);
    expect(create).toBeGreaterThanOrEqual(0);
    expect(copy).toBeGreaterThan(create);
    for (const drop of [dropFk, dropIndex, dropColumn]) expect(drop).toBeGreaterThan(copy);
  });

  it('có bước đối chiếu số dòng trước khi xóa cột cũ', () => {
    const verify = at(/assignee_copy_verified/);
    expect(verify).toBeGreaterThan(at(/INSERT (IGNORE )?INTO `TaskAssignee`/));
    expect(verify).toBeLessThan(at(/DROP COLUMN `assigneeId`/));
  });
});
