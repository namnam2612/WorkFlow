import { mkdtemp, readdir, rm, stat, writeFile } from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'os';
import { join } from 'path';
import { asPrisma, createPrismaMock } from '../test-utils';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { ownerFolder, projectFolder, storagePath, taskFolder } from './file-layout';
import { LocalStorageService } from './local-storage.service';

describe('file-layout', () => {
  it('file dự án: projects/{projectId}/{uuid}.{ext}', () => {
    expect(storagePath({ projectId: 3, taskId: null }, 'abc.pdf')).toBe('projects/3/abc.pdf');
  });
  it('file task: projects/{projectId}/tasks/{taskId}/{uuid}.{ext}', () => {
    expect(storagePath({ projectId: 3, taskId: 12 }, 'abc.pdf')).toBe('projects/3/tasks/12/abc.pdf');
    expect(projectFolder(3)).toBe('projects/3');
    expect(taskFolder(3, 12)).toBe('projects/3/tasks/12');
    expect(ownerFolder({ projectId: 3, taskId: 12 })).toBe('projects/3/tasks/12');
  });
});

describe('LocalStorageService - thư mục', () => {
  let root: string;
  let storage: LocalStorageService;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'taskflow-storage-'));
    storage = new LocalStorageService(new ConfigService({ UPLOAD_DIR: root }));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const exists = (p: string) => stat(join(root, p)).then(() => true, () => false);

  it('save tạo thư mục theo cấu trúc mới; deleteDirectory xóa cả thư mục task cùng mọi file bên trong', async () => {
    await storage.save('projects/3/tasks/12/a.pdf', Buffer.from('x'));
    await storage.save('projects/3/tasks/12/b.png', Buffer.from('y'));
    await storage.save('projects/3/tasks/13/c.txt', Buffer.from('z'));
    await storage.deleteDirectory('projects/3/tasks/12');
    expect(await exists('projects/3/tasks/12')).toBe(false);
    expect(await exists('projects/3/tasks/13/c.txt')).toBe(true); // task khác không bị ảnh hưởng
  });

  it('xóa thư mục dự án xóa cả file chung lẫn thư mục task bên trong', async () => {
    await storage.save('projects/3/common.pdf', Buffer.from('x'));
    await storage.save('projects/3/tasks/12/a.pdf', Buffer.from('y'));
    await storage.save('projects/4/keep.pdf', Buffer.from('k'));
    await storage.deleteDirectory('projects/3');
    expect(await exists('projects/3')).toBe(false);
    expect(await exists('projects/4/keep.pdf')).toBe(true);
  });

  it('thư mục không tồn tại thì không lỗi', async () => {
    await expect(storage.deleteDirectory('projects/999')).resolves.toBeUndefined();
  });

  it('từ chối thoát ra ngoài thư mục gốc hoặc xóa chính thư mục gốc (không xóa gì)', async () => {
    await writeFile(join(root, 'giu-lai.txt'), 'x');
    await storage.deleteDirectory('../');
    await storage.deleteDirectory('.');
    await storage.deleteDirectory('');
    expect((await readdir(root)).includes('giu-lai.txt')).toBe(true);
  });
});

describe('AttachmentCleanupService - dọn file khi xóa task/dự án', () => {
  const setup = () => {
    const prisma = createPrismaMock();
    const storage = { delete: jest.fn().mockResolvedValue(undefined), deleteDirectory: jest.fn().mockResolvedValue(undefined) };
    const service = new AttachmentCleanupService(asPrisma(prisma), storage as never);
    return { prisma, storage, service };
  };

  it('task: gom file (cả của công việc con) và thư mục của task + từng công việc con', async () => {
    const { prisma, service } = setup();
    prisma.attachment.findMany.mockResolvedValue([{ path: 'projects/3/tasks/12/a.pdf' }, { path: '2026/11/cu.pdf' }, { path: 'projects/3/tasks/13/s.png' }]);
    prisma.task.findMany.mockResolvedValue([
      { id: 12, projectId: 3 },
      { id: 13, projectId: 3 },
    ]);
    expect(await service.collectTaskTargets(12)).toEqual({
      files: ['projects/3/tasks/12/a.pdf', '2026/11/cu.pdf', 'projects/3/tasks/13/s.png'],
      dirs: ['projects/3/tasks/12', 'projects/3/tasks/13'],
    });
  });

  it('dự án: gom file của dự án + của task và thư mục projects/{id}', async () => {
    const { prisma, service } = setup();
    prisma.attachment.findMany.mockResolvedValue([{ path: 'projects/3/x.pdf' }, { path: 'projects/3/tasks/12/a.pdf' }]);
    const targets = await service.collectProjectTargets(3);
    expect(targets).toEqual({ files: ['projects/3/x.pdf', 'projects/3/tasks/12/a.pdf'], dirs: ['projects/3'] });
    expect(prisma.attachment.findMany).toHaveBeenCalledWith({ where: { OR: [{ projectId: 3 }, { task: { projectId: 3 } }] }, select: { path: true } });
  });

  it('cleanup xóa từng file (kể cả file còn ở cấu trúc cũ) rồi xóa thư mục', async () => {
    const { storage, service } = setup();
    await service.cleanup({ files: ['2026/11/cu.pdf', 'projects/3/tasks/12/a.pdf'], dirs: ['projects/3/tasks/12'] });
    expect(storage.delete).toHaveBeenCalledWith('2026/11/cu.pdf');
    expect(storage.delete).toHaveBeenCalledWith('projects/3/tasks/12/a.pdf');
    expect(storage.deleteDirectory).toHaveBeenCalledWith('projects/3/tasks/12');
  });
});

