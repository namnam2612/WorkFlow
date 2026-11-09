import { PrismaClient } from '@prisma/client';
import { constants } from 'fs';
import { access, copyFile, mkdir, readdir, rename, rmdir, stat, unlink } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { storagePath } from './file-layout';

export interface MigrateOptions {
  /** Thư mục gốc lưu file (UPLOAD_DIR) */
  root: string;
  /** Chỉ báo cáo việc sẽ làm, không đổi gì */
  dryRun?: boolean;
  log?: (message: string) => void;
}

export interface MigrateReport {
  total: number;
  /** Đã chuyển file sang cấu trúc mới và cập nhật DB */
  moved: number;
  /** Đã ở đúng chỗ từ trước (chạy lại) */
  alreadyOk: number;
  /** File đã ở chỗ mới (lần chạy trước bị ngắt giữa chừng) => chỉ sửa lại DB */
  repaired: number;
  /** Có bản ghi nhưng không thấy file ở cả chỗ cũ lẫn chỗ mới: để nguyên, chỉ báo cáo */
  missing: { id: number; path: string }[];
  /** Không xử lý được (vd bản ghi mồ côi, hai file khác nội dung cùng đích) */
  failed: { id: number; reason: string }[];
  removedEmptyDirs: number;
}

type AttachmentDb = Pick<PrismaClient, 'attachment'>;

const BATCH = 200;

const exists = (path: string): Promise<boolean> =>
  access(path, constants.F_OK).then(
    () => true,
    () => false,
  );

/** Đường dẫn tuyệt đối của khóa lưu; từ chối khóa thoát ra ngoài thư mục gốc */
function resolveInside(root: string, key: string): string {
  const full = resolve(root, key);
  const rel = relative(root, full);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Đường dẫn không hợp lệ: ${key}`);
  return full;
}

/** Đổi tên; khác ổ đĩa (EXDEV) thì sao chép rồi xóa bản gốc */
async function moveFile(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await copyFile(from, to, constants.COPYFILE_EXCL);
    await unlink(from);
  }
}

/**
 * Chuyển file đã lưu theo cấu trúc cũ (YYYY/MM/uuid.ext) sang cấu trúc mới
 *   projects/{projectId}/uuid.ext và projects/{projectId}/tasks/{taskId}/uuid.ext
 * và cập nhật cột Attachment.path. An toàn khi chạy lại nhiều lần: mỗi file chỉ làm khi cần, thứ tự
 * "đổi tên file -> cập nhật DB" luôn có thể phục hồi (nếu dừng giữa chừng, lần chạy sau thấy file đã ở chỗ mới và chỉ sửa DB);
 * không bao giờ ghi đè file khác. Tên file lưu (UUID) giữ nguyên.
 */
export async function migrateFileLayout(prisma: AttachmentDb, options: MigrateOptions): Promise<MigrateReport> {
  const root = resolve(options.root);
  const log = options.log ?? (() => undefined);
  const dryRun = options.dryRun ?? false;
  const report: MigrateReport = { total: 0, moved: 0, alreadyOk: 0, repaired: 0, missing: [], failed: [], removedEmptyDirs: 0 };

  let cursor = 0;
  for (;;) {
    const rows = await prisma.attachment.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: BATCH,
      select: { id: true, path: true, storedName: true, taskId: true, projectId: true, task: { select: { projectId: true } } },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      report.total++;
      const projectId = row.projectId ?? row.task?.projectId;
      if (projectId === undefined || projectId === null) {
        report.failed.push({ id: row.id, reason: 'bản ghi không thuộc dự án hay công việc nào' });
        continue;
      }
      const target = storagePath({ projectId, taskId: row.taskId }, row.storedName);
      if (row.path === target) {
        report.alreadyOk++;
        continue;
      }
      try {
        const from = resolveInside(root, row.path);
        const to = resolveInside(root, target);
        const [hasFrom, hasTo] = await Promise.all([exists(from), exists(to)]);

        if (!hasFrom && !hasTo) {
          report.missing.push({ id: row.id, path: row.path });
          log(`#${row.id}: không thấy file ${row.path} (bỏ qua)`);
          continue;
        }
        if (hasFrom && hasTo) {
          // Hai bản cùng đích: chỉ coi là cùng một file khi dung lượng bằng nhau (lần chạy trước đã sao chép nhưng chưa kịp xóa bản gốc)
          const [a, b] = await Promise.all([stat(from), stat(to)]);
          if (a.size !== b.size) {
            report.failed.push({ id: row.id, reason: `đích ${target} đã tồn tại với nội dung khác` });
            continue;
          }
        }
        if (dryRun) {
          log(`#${row.id}: ${row.path} -> ${target}`);
          report[hasTo ? 'repaired' : 'moved']++;
          continue;
        }
        if (hasFrom && !hasTo) await moveFile(from, to);
        await prisma.attachment.update({ where: { id: row.id }, data: { path: target } });
        if (hasFrom && hasTo) await unlink(from); // DB đã trỏ sang bản mới, bản cũ thừa
        report[hasTo ? 'repaired' : 'moved']++;
        log(`#${row.id}: ${row.path} -> ${target}`);
      } catch (error) {
        report.failed.push({ id: row.id, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  if (!dryRun) report.removedEmptyDirs = await removeEmptyLegacyDirs(root);
  return report;
}

/** Dọn các thư mục YYYY/MM rỗng của cấu trúc cũ (chỉ thư mục rỗng, không bao giờ xóa file) */
async function removeEmptyLegacyDirs(root: string): Promise<number> {
  let removed = 0;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const year of entries.filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))) {
    const yearDir = join(root, year.name);
    const months = await readdir(yearDir, { withFileTypes: true }).catch(() => []);
    for (const month of months.filter((e) => e.isDirectory() && /^\d{2}$/.test(e.name))) {
      if (await rmdir(join(yearDir, month.name)).then(() => true, () => false)) removed++;
    }
    if (await rmdir(yearDir).then(() => true, () => false)) removed++;
  }
  return removed;
}
