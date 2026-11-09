import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { ProjectAccessService } from '../projects/project-access.service';
import { asPrisma, callArg, createPrismaMock, PrismaMock } from '../test-utils';
import { StatusesService } from './statuses.service';

const owner: AuthUser = { id: 10, email: 'o@x.vn', name: 'Leader', role: 'leader' };
const member: AuthUser = { id: 20, email: 'm@x.vn', name: 'Member', role: 'member' };
const PROJECT = { id: 1, name: 'A', createdById: 10 };

const st = (id: number, name: string, category: ProjectStatus['category'], scope: ProjectStatus['scope'] = 'task', position = id, projectId = 1): ProjectStatus => ({
  id,
  projectId,
  scope,
  name,
  color: '#112233',
  category,
  position,
  createdAt: new Date(),
});

describe('StatusesService', () => {
  let prisma: PrismaMock;
  let service: StatusesService;
  let rows: ProjectStatus[];

  beforeEach(() => {
    prisma = createPrismaMock();
    rows = [st(1, 'Cần làm', 'todo'), st(2, 'Đang làm', 'in_progress'), st(3, 'Hoàn thành', 'done'), st(11, 'Mới', 'todo', 'bug', 0), st(12, 'Đã đóng', 'done', 'bug', 1)];
    prisma.project.findUnique.mockResolvedValue(PROJECT);
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 1, userId: 20 });
    prisma.projectStatus.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(rows.find((r) => r.id === where.id) ?? null));
    prisma.projectStatus.findMany.mockImplementation(({ where }: { where: { scope?: string } }) => Promise.resolve(rows.filter((r) => !where.scope || r.scope === where.scope)));
    prisma.projectStatus.findFirst.mockImplementation(({ where }: { where: { scope: string; name?: string; category?: string; id?: { not: number } } }) =>
      Promise.resolve(rows.find((r) => r.scope === where.scope && (where.name === undefined || r.name === where.name) && (where.category === undefined || r.category === where.category) && r.id !== where.id?.not) ?? null),
    );
    prisma.projectStatus.aggregate.mockResolvedValue({ _max: { position: 2 } });
    prisma.projectStatus.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 99, ...data }));
    prisma.projectStatus.update.mockImplementation(({ where, data }: { where: { id: number }; data: object }) => Promise.resolve({ ...rows.find((r) => r.id === where.id), ...data }));
    prisma.task.count.mockResolvedValue(0);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.aggregate.mockResolvedValue({ _max: { position: 4 } });
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    service = new StatusesService(asPrisma(prisma), new ProjectAccessService(asPrisma(prisma)));
  });

  describe('quyền', () => {
    it('member xem được danh sách nhưng không tạo/sửa/xóa/sắp xếp', async () => {
      await expect(service.list(member, 1)).resolves.toBeDefined();
      await expect(service.create(member, 1, { scope: 'task', name: 'X', color: '#000000', category: 'todo' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.update(member, 1, 1, { name: 'Y' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(member, 1, 1)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.reorder(member, 1, { scope: 'task', ids: [1, 2, 3] })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('leader của dự án khác không quản lý được', async () => {
      await expect(service.create({ ...owner, id: 11 }, 1, { scope: 'task', name: 'X', color: '#000000', category: 'todo' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create', () => {
    it('xếp cuối bộ', async () => {
      await service.create(owner, 1, { scope: 'task', name: 'Kiểm thử', color: '#abcdef', category: 'in_progress' });
      expect(callArg(prisma.projectStatus.create)).toMatchObject({ data: { projectId: 1, scope: 'task', name: 'Kiểm thử', position: 3 } });
    });

    it('tên trùng trong cùng bộ bị từ chối, nhưng được trùng với bộ khác (Bug)', async () => {
      await expect(service.create(owner, 1, { scope: 'task', name: 'Cần làm', color: '#000000', category: 'todo' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create(owner, 1, { scope: 'bug', name: 'Cần làm', color: '#000000', category: 'todo' })).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('không cho đổi nhóm làm mất trạng thái "Hoàn thành" cuối cùng', async () => {
      await expect(service.update(owner, 1, 3, { category: 'in_progress' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không cho đổi nhóm làm bộ chỉ còn trạng thái "Hoàn thành"', async () => {
      rows = [st(1, 'Cần làm', 'todo'), st(3, 'Hoàn thành', 'done')];
      await expect(service.update(owner, 1, 1, { category: 'done' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('đổi sang nhóm "done" thì đặt completedAt cho task đang ở đó; rời nhóm thì xóa', async () => {
      await service.update(owner, 1, 2, { category: 'done' });
      expect(callArg(prisma.task.updateMany)).toMatchObject({ where: { statusId: 2, completedAt: null }, data: { completedAt: expect.any(Date) as Date } });
      prisma.task.updateMany.mockClear();
      rows.push(st(4, 'Đã nghiệm thu', 'done'));
      await service.update(owner, 1, 3, { category: 'in_progress' });
      expect(callArg(prisma.task.updateMany)).toMatchObject({ where: { statusId: 3, completedAt: { not: null } }, data: { completedAt: null } });
    });

    it('trạng thái của dự án khác => 404', async () => {
      rows.push(st(50, 'Lạ', 'todo', 'task', 0, 2));
      await expect(service.update(owner, 1, 50, { name: 'Z' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('còn task thì bắt buộc chọn trạng thái chuyển sang', async () => {
      prisma.task.count.mockResolvedValue(3);
      await expect(service.remove(owner, 1, 2)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không chuyển sang trạng thái của bộ khác (Bug) hoặc chính nó', async () => {
      prisma.task.count.mockResolvedValue(3);
      await expect(service.remove(owner, 1, 2, 11)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.remove(owner, 1, 2, 2)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không xóa trạng thái "Hoàn thành" cuối cùng', async () => {
      await expect(service.remove(owner, 1, 3)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('chuyển task sang trạng thái đích (xếp nối đuôi, completedAt theo nhóm đích) rồi xóa', async () => {
      prisma.task.count.mockResolvedValue(2);
      prisma.task.findMany.mockResolvedValue([
        { id: 7, completedAt: null },
        { id: 8, completedAt: null },
      ]);
      await service.remove(owner, 1, 2, 3);
      const updates = (prisma.task.update.mock.calls as { 0: { where: { id: number }; data: { statusId: number; position: number; completedAt: unknown } } }[]).map((c) => c[0]);
      expect(updates.map((u) => [u.where.id, u.data.statusId, u.data.position])).toEqual([
        [7, 3, 5],
        [8, 3, 6],
      ]);
      expect(updates[0]?.data.completedAt).toBeInstanceOf(Date); // đích là nhóm "done"
      expect(prisma.projectStatus.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    });
  });

  describe('reorder', () => {
    it('phải gồm đúng tất cả id của bộ', async () => {
      await expect(service.reorder(owner, 1, { scope: 'task', ids: [1, 2] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.reorder(owner, 1, { scope: 'task', ids: [1, 2, 11] })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cập nhật position theo thứ tự mới', async () => {
      await service.reorder(owner, 1, { scope: 'task', ids: [3, 1, 2] });
      const calls = (prisma.projectStatus.update.mock.calls as { 0: { where: { id: number }; data: { position: number } } }[]).map((c) => [c[0].where.id, c[0].data.position]);
      expect(calls).toEqual([
        [3, 0],
        [1, 1],
        [2, 2],
      ]);
    });
  });

  describe('resolve / mapToScope (TasksService dùng)', () => {
    it('không truyền id => trạng thái đầu tiên của bộ', async () => {
      await expect(service.resolve(1, 'bug')).resolves.toMatchObject({ id: 11 });
    });

    it('từ chối trạng thái sai bộ hoặc thuộc dự án khác', async () => {
      await expect(service.resolve(1, 'task', 11)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.resolve(1, 'bug', 1)).rejects.toBeInstanceOf(BadRequestException);
      rows.push(st(50, 'Lạ', 'todo', 'task', 0, 2));
      await expect(service.resolve(1, 'task', 50)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('đổi bộ: giữ nhóm nếu có trạng thái tương ứng, ngược lại lấy trạng thái đầu', async () => {
      await expect(service.mapToScope(1, 'bug', 'done')).resolves.toMatchObject({ id: 12 });
      await expect(service.mapToScope(1, 'bug', 'in_progress')).resolves.toMatchObject({ id: 11 });
    });
  });
});
