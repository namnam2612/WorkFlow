import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus, StatusCategory, StatusScope } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateStatusDto, ReorderStatusesDto, UpdateStatusDto } from './dto/status.dto';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Bộ trạng thái (cột Kanban) tùy biến theo dự án. Mỗi bộ (công việc / Bug) luôn phải có ít nhất một trạng thái
 * thuộc nhóm "done" và ít nhất một trạng thái chưa xong, nếu không hệ thống không tính được tiến độ.
 */
@Injectable()
export class StatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async list(user: AuthUser, projectId: number, scope?: StatusScope): Promise<ProjectStatus[]> {
    await this.access.assertCanView(user, projectId);
    return this.prisma.projectStatus.findMany({
      where: { projectId, ...(scope ? { scope } : {}) },
      orderBy: [{ scope: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
  }

  async create(user: AuthUser, projectId: number, dto: CreateStatusDto): Promise<ProjectStatus> {
    await this.access.assertCanManage(user, projectId);
    await this.assertNameFree(projectId, dto.scope, dto.name);
    const max = await this.prisma.projectStatus.aggregate({ where: { projectId, scope: dto.scope }, _max: { position: true } });
    return this.prisma.projectStatus.create({
      data: { projectId, scope: dto.scope, name: dto.name, color: dto.color, category: dto.category, position: (max._max.position ?? -1) + 1 },
    });
  }

  async update(user: AuthUser, projectId: number, statusId: number, dto: UpdateStatusDto): Promise<ProjectStatus> {
    await this.access.assertCanManage(user, projectId);
    const status = await this.findOrThrow(projectId, statusId);
    if (dto.name !== undefined && dto.name !== status.name) await this.assertNameFree(projectId, status.scope, dto.name, statusId);

    const categoryChanged = dto.category !== undefined && dto.category !== status.category;
    if (categoryChanged) {
      const siblings = await this.prisma.projectStatus.findMany({ where: { projectId, scope: status.scope } });
      this.assertKeepsBothKinds(siblings.map((s) => (s.id === statusId ? { ...s, category: dto.category as StatusCategory } : s)));
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectStatus.update({ where: { id: statusId }, data: { name: dto.name, color: dto.color, category: dto.category } });
      if (categoryChanged) await this.syncCompletedAt(tx, statusId, updated.category);
      return updated;
    });
  }

  /** Xóa trạng thái; công việc đang ở đó được chuyển sang `moveTo` (cùng bộ, cùng dự án) */
  async remove(user: AuthUser, projectId: number, statusId: number, moveTo?: number): Promise<void> {
    await this.access.assertCanManage(user, projectId);
    const status = await this.findOrThrow(projectId, statusId);
    const siblings = await this.prisma.projectStatus.findMany({ where: { projectId, scope: status.scope } });
    this.assertKeepsBothKinds(siblings.filter((s) => s.id !== statusId));

    const taskCount = await this.prisma.task.count({ where: { statusId } });
    let target: ProjectStatus | null = null;
    if (taskCount > 0) {
      if (moveTo === undefined) throw new BadRequestException(`Còn ${taskCount} công việc ở trạng thái này, hãy chọn trạng thái để chuyển chúng sang`);
      if (moveTo === statusId) throw new BadRequestException('Trạng thái đích phải khác trạng thái bị xóa');
      target = await this.findOrThrow(projectId, moveTo);
      if (target.scope !== status.scope) throw new BadRequestException('Chỉ chuyển được sang trạng thái cùng bộ (công việc hoặc Bug)');
    }

    await this.prisma.$transaction(async (tx) => {
      if (target) {
        const base = ((await tx.task.aggregate({ where: { statusId: target.id }, _max: { position: true } }))._max.position ?? -1) + 1;
        const moving = await tx.task.findMany({ where: { statusId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, completedAt: true } });
        for (const [i, t] of moving.entries()) {
          await tx.task.update({
            where: { id: t.id },
            data: { statusId: target.id, position: base + i, completedAt: target.category === 'done' ? (t.completedAt ?? new Date()) : null },
          });
        }
      }
      await tx.projectStatus.delete({ where: { id: statusId } });
      await this.renumber(tx, projectId, status.scope);
    });
  }

  async reorder(user: AuthUser, projectId: number, dto: ReorderStatusesDto): Promise<ProjectStatus[]> {
    await this.access.assertCanManage(user, projectId);
    const current = await this.prisma.projectStatus.findMany({ where: { projectId, scope: dto.scope } });
    const same = current.length === dto.ids.length && current.every((s) => dto.ids.includes(s.id));
    if (!same) throw new BadRequestException('Danh sách thứ tự phải gồm đúng tất cả trạng thái của bộ này');
    await this.prisma.$transaction(
      dto.ids.map((id, position) => this.prisma.projectStatus.update({ where: { id }, data: { position } })),
    );
    return this.list(user, projectId, dto.scope);
  }

  // ------------------------------------------------- dùng bởi TasksService

  /** Trạng thái hợp lệ của dự án và đúng bộ; không có `statusId` thì lấy trạng thái đầu tiên của bộ */
  async resolve(projectId: number, scope: StatusScope, statusId?: number | null, db: Db = this.prisma): Promise<ProjectStatus> {
    if (statusId === undefined || statusId === null) {
      const first = await db.projectStatus.findFirst({ where: { projectId, scope }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
      if (!first) throw new BadRequestException('Dự án chưa có trạng thái nào');
      return first;
    }
    const status = await db.projectStatus.findUnique({ where: { id: statusId } });
    if (!status || status.projectId !== projectId) throw new BadRequestException('Trạng thái không thuộc dự án này');
    if (status.scope !== scope) throw new BadRequestException(scope === 'bug' ? 'Bug phải dùng trạng thái của Bug' : 'Công việc này không dùng trạng thái của Bug');
    return status;
  }

  /** Khi đổi loại giữa công việc ⇄ Bug: chọn trạng thái cùng nhóm ở bộ mới (không có thì trạng thái đầu) */
  async mapToScope(projectId: number, scope: StatusScope, category: StatusCategory, db: Db = this.prisma): Promise<ProjectStatus> {
    const sameCategory = await db.projectStatus.findFirst({ where: { projectId, scope, category }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
    return sameCategory ?? this.resolve(projectId, scope, undefined, db);
  }

  // ------------------------------------------------------------- helpers

  private async findOrThrow(projectId: number, statusId: number): Promise<ProjectStatus> {
    const status = await this.prisma.projectStatus.findUnique({ where: { id: statusId } });
    if (!status || status.projectId !== projectId) throw new NotFoundException('Không tìm thấy trạng thái');
    return status;
  }

  private async assertNameFree(projectId: number, scope: StatusScope, name: string, exceptId?: number): Promise<void> {
    const dup = await this.prisma.projectStatus.findFirst({ where: { projectId, scope, name, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    if (dup) throw new BadRequestException(`Đã có trạng thái tên "${name}" trong bộ này`);
  }

  private assertKeepsBothKinds(statuses: { category: StatusCategory }[]): void {
    if (!statuses.some((s) => s.category === 'done')) throw new BadRequestException('Bộ trạng thái phải còn ít nhất một trạng thái thuộc nhóm "Hoàn thành"');
    if (!statuses.some((s) => s.category !== 'done')) throw new BadRequestException('Bộ trạng thái phải còn ít nhất một trạng thái chưa hoàn thành');
  }

  /** Đổi nhóm của một trạng thái: task đang ở đó phải có/không có completedAt cho đúng nhóm mới */
  private async syncCompletedAt(tx: Prisma.TransactionClient, statusId: number, category: StatusCategory): Promise<void> {
    if (category === 'done') await tx.task.updateMany({ where: { statusId, completedAt: null }, data: { completedAt: new Date() } });
    else await tx.task.updateMany({ where: { statusId, completedAt: { not: null } }, data: { completedAt: null } });
  }

  private async renumber(tx: Prisma.TransactionClient, projectId: number, scope: StatusScope): Promise<void> {
    const rest = await tx.projectStatus.findMany({ where: { projectId, scope }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } });
    for (const [position, s] of rest.entries()) await tx.projectStatus.update({ where: { id: s.id }, data: { position } });
  }
}
