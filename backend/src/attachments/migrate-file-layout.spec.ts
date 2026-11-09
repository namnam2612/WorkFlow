import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { migrateFileLayout } from './migrate-file-layout';

interface Row {
  id: number;
  path: string;
  storedName: string;
  taskId: number | null;
  projectId: number | null;
  task: { projectId: number } | null;
}

/** Prisma giả chỉ có attachment.findMany/update trên mảng trong bộ nhớ (đủ cho script migrate) */
function fakeDb(rows: Row[]) {
  return {
    rows,
    attachment: {
      findMany: jest.fn(({ where, take }: { where: { id: { gt: number } }; take: number }) =>
        Promise.resolve(rows.filter((r) => r.id > where.id.gt).sort((a, b) => a.id - b.id).slice(0, take)),
      ),
      update: jest.fn(({ where, data }: { where: { id: number }; data: { path: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) row.path = data.path;
        return Promise.resolve(row);
      }),
    },
  };
}

const exists = (p: string) => stat(p).then(() => true, () => false);

describe('migrateFileLayout - chuyển file sang cấu trúc projects/{id}/tasks/{id}', () => {
  let root: string;

  const put = async (key: string, content: string) => {
    const full = join(root, key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  };

  const rows = (): Row[] => [
    { id: 1, path: '2026/11/aaa.pdf', storedName: 'aaa.pdf', taskId: 7, projectId: null, task: { projectId: 3 } }, // file task
    { id: 2, path: '2026/11/bbb.png', storedName: 'bbb.png', taskId: null, projectId: 3, task: null }, // file dự án
    { id: 3, path: '2026/10/ccc.txt', storedName: 'ccc.txt', taskId: 9, projectId: null, task: { projectId: 4 } },
  ];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'taskflow-uploads-'));
    await put('2026/11/aaa.pdf', 'A');
    await put('2026/11/bbb.png', 'B');
    await put('2026/10/ccc.txt', 'C');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('chuyển file task và file dự án vào đúng thư mục, giữ nguyên tên UUID, cập nhật cột path, giữ nguyên nội dung', async () => {
    const db = fakeDb(rows());
    const report = await migrateFileLayout(db as never, { root });
    expect(report).toMatchObject({ total: 3, moved: 3, alreadyOk: 0, repaired: 0, missing: [], failed: [] });
    expect(db.rows.map((r) => r.path)).toEqual(['projects/3/tasks/7/aaa.pdf', 'projects/3/bbb.png', 'projects/4/tasks/9/ccc.txt']);
    expect(await readFile(join(root, 'projects/3/tasks/7/aaa.pdf'), 'utf8')).toBe('A');
    expect(await readFile(join(root, 'projects/3/bbb.png'), 'utf8')).toBe('B');
    expect(await readFile(join(root, 'projects/4/tasks/9/ccc.txt'), 'utf8')).toBe('C');
    expect(await exists(join(root, '2026/11/aaa.pdf'))).toBe(false);
  });

  it('dọn thư mục YYYY/MM rỗng của cấu trúc cũ', async () => {
    const report = await migrateFileLayout(fakeDb(rows()) as never, { root });
    expect(report.removedEmptyDirs).toBe(3); // 2026/11, 2026/10 và 2026
    expect((await readdir(root)).sort()).toEqual(['projects']);
  });

  it('chạy lại nhiều lần không lỗi và không đổi gì thêm', async () => {
    const db = fakeDb(rows());
    await migrateFileLayout(db as never, { root });
    const again = await migrateFileLayout(db as never, { root });
    expect(again).toMatchObject({ total: 3, moved: 0, alreadyOk: 3, repaired: 0, missing: [], failed: [] });
    const third = await migrateFileLayout(db as never, { root });
    expect(third.alreadyOk).toBe(3);
    expect(db.rows.map((r) => r.path)[0]).toBe('projects/3/tasks/7/aaa.pdf');
  });

  it('dry-run chỉ báo cáo: không di chuyển file, không sửa DB', async () => {
    const db = fakeDb(rows());
    const report = await migrateFileLayout(db as never, { root, dryRun: true });
    expect(report.moved).toBe(3);
    expect(db.attachment.update).not.toHaveBeenCalled();
    expect(db.rows[0].path).toBe('2026/11/aaa.pdf');
    expect(await exists(join(root, '2026/11/aaa.pdf'))).toBe(true);
    expect(await exists(join(root, 'projects'))).toBe(false);
  });

  it('phục hồi khi lần chạy trước bị ngắt: file đã chuyển nhưng DB còn trỏ chỗ cũ -> chỉ sửa DB', async () => {
    const db = fakeDb(rows());
    await mkdir(join(root, 'projects/3/tasks/7'), { recursive: true });
    await writeFile(join(root, 'projects/3/tasks/7/aaa.pdf'), 'A');
    await rm(join(root, '2026/11/aaa.pdf'));
    const report = await migrateFileLayout(db as never, { root });
    expect(report.repaired).toBe(1);
    expect(report.moved).toBe(2);
    expect(db.rows[0].path).toBe('projects/3/tasks/7/aaa.pdf');
  });

  it('bản sao đã tồn tại với cùng dung lượng (ngắt sau khi sao chép) -> sửa DB và xóa bản cũ thừa', async () => {
    const db = fakeDb(rows());
    await mkdir(join(root, 'projects/3/tasks/7'), { recursive: true });
    await writeFile(join(root, 'projects/3/tasks/7/aaa.pdf'), 'A');
    const report = await migrateFileLayout(db as never, { root });
    expect(report.failed).toEqual([]);
    expect(db.rows[0].path).toBe('projects/3/tasks/7/aaa.pdf');
    expect(await exists(join(root, '2026/11/aaa.pdf'))).toBe(false);
  });

  it('KHÔNG ghi đè: đích đã có file khác nội dung thì báo lỗi và giữ nguyên cả hai', async () => {
    const db = fakeDb(rows());
    await mkdir(join(root, 'projects/3/tasks/7'), { recursive: true });
    await writeFile(join(root, 'projects/3/tasks/7/aaa.pdf'), 'KHÁC DUNG LƯỢNG');
    const report = await migrateFileLayout(db as never, { root });
    expect(report.failed).toEqual([{ id: 1, reason: expect.stringContaining('đã tồn tại') as string }]);
    expect(db.rows[0].path).toBe('2026/11/aaa.pdf');
    expect(await readFile(join(root, '2026/11/aaa.pdf'), 'utf8')).toBe('A');
    expect(await readFile(join(root, 'projects/3/tasks/7/aaa.pdf'), 'utf8')).toBe('KHÁC DUNG LƯỢNG');
    expect(report.moved).toBe(2); // các file khác vẫn được chuyển
  });

  it('file mất trên ổ đĩa: chỉ báo cáo, để nguyên bản ghi, không làm hỏng các file khác', async () => {
    const db = fakeDb(rows());
    await rm(join(root, '2026/10/ccc.txt'));
    const report = await migrateFileLayout(db as never, { root });
    expect(report.missing).toEqual([{ id: 3, path: '2026/10/ccc.txt' }]);
    expect(report.moved).toBe(2);
    expect(db.rows[2].path).toBe('2026/10/ccc.txt');
  });

  it('bản ghi mồ côi (không thuộc dự án/task) và đường dẫn thoát ra ngoài thư mục gốc bị từ chối, không đụng file ngoài', async () => {
    const db = fakeDb([
      { id: 1, path: '2026/11/aaa.pdf', storedName: 'aaa.pdf', taskId: null, projectId: null, task: null },
      { id: 2, path: '../../etc/passwd', storedName: 'x.txt', taskId: null, projectId: 3, task: null },
    ]);
    const report = await migrateFileLayout(db as never, { root });
    expect(report.moved).toBe(0);
    expect(report.failed.map((f) => f.id)).toEqual([1, 2]);
    expect(await exists(join(root, '2026/11/aaa.pdf'))).toBe(true);
  });

  it('không xóa thư mục cũ còn file lạ (chỉ xóa thư mục rỗng)', async () => {
    await put('2026/11/khong-co-trong-db.bin', 'X');
    await migrateFileLayout(fakeDb(rows()) as never, { root });
    expect(await exists(join(root, '2026/11/khong-co-trong-db.bin'))).toBe(true);
  });

  it('xử lý được nhiều hơn một lô (cursor theo id)', async () => {
    const many: Row[] = [];
    for (let i = 1; i <= 450; i++) {
      many.push({ id: i, path: `2026/11/f${i}.txt`, storedName: `f${i}.txt`, taskId: null, projectId: 1, task: null });
      await put(`2026/11/f${i}.txt`, String(i));
    }
    const db = fakeDb(many);
    const report = await migrateFileLayout(db as never, { root });
    expect(report).toMatchObject({ total: 450, moved: 450, failed: [] });
    expect(db.attachment.findMany.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
