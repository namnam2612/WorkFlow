/**
 * Chuyển file đính kèm từ cấu trúc cũ (UPLOAD_DIR/YYYY/MM/uuid.ext) sang cấu trúc mới
 * (UPLOAD_DIR/projects/{projectId}/... và projects/{projectId}/tasks/{taskId}/...) và cập nhật Attachment.path.
 * Chạy lại nhiều lần an toàn. Nên chạy `--dry-run` trước và sao lưu thư mục uploads + MySQL.
 *
 *   npm run build && npm run migrate:files -- --dry-run   # chỉ in việc sẽ làm
 *   npm run migrate:files                                  # thực hiện
 * Trong Docker (image đã build sẵn):  docker compose exec backend npm run migrate:files
 */
import { PrismaClient } from '@prisma/client';
import { resolve } from 'path';
import { migrateFileLayout } from './migrate-file-layout';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  const prisma = new PrismaClient();
  try {
    console.log(`${dryRun ? '[DRY-RUN] ' : ''}Thư mục file: ${root}`);
    const report = await migrateFileLayout(prisma, { root, dryRun, log: (m) => console.log('  ' + m) });
    console.log(
      `\nTổng ${report.total} file: đã chuyển ${report.moved}, sửa DB ${report.repaired}, đã đúng chỗ ${report.alreadyOk}, ` +
        `không thấy file ${report.missing.length}, lỗi ${report.failed.length}, dọn ${report.removedEmptyDirs} thư mục rỗng cũ.`,
    );
    for (const m of report.missing) console.warn(`  CẢNH BÁO #${m.id}: không thấy file ${m.path}`);
    for (const f of report.failed) console.error(`  LỖI #${f.id}: ${f.reason}`);
    if (report.failed.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
