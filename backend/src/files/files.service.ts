import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { attachmentInclude, AttachmentsService } from '../attachments/attachments.service';
import { Paginated, toPaginated } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { STATUS_SELECT } from '../statuses/status-view';
import { FileListQueryDto, FileSearchQueryDto, FolderQueryDto } from './dto/files-query.dto';

/** Số file, tổng dung lượng và thời điểm file mới nhất của một thư mục */
export interface FolderStats {
  fileCount: number;
  totalSize: number;
  latestAt: Date | null;
}

const NO_FILES: FolderStats = { fileCount: 0, totalSize: 0, latestAt: null };

interface ProjectStatsRow {
  id: number;
  fileCount: bigint | number;
  totalSize: bigint | number | null;
  latestAt: Date | null;
}

/** So sánh theo `name` (A→Z, có dấu tiếng Việt) hoặc `updatedAt` (mới nhất trước, thư mục trống xếp cuối) */
function folderComparator<T extends { name: string; latestAt: Date | null }>(sortBy: 'name' | 'updatedAt', order: 'asc' | 'desc') {
  const dir = order === 'asc' ? 1 : -1;
  return (a: T, b: T): number => {
    if (sortBy === 'name') return dir * a.name.localeCompare(b.name, 'vi');
    const at = a.latestAt?.getTime() ?? null;
    const bt = b.latestAt?.getTime() ?? null;
    if (at === null && bt === null) return a.name.localeCompare(b.name, 'vi');
    if (at === null) return 1; // không có file luôn ở cuối, bất kể chiều sắp xếp
    if (bt === null) return -1;
    return dir * (at - bt) || a.name.localeCompare(b.name, 'vi');
  };
}

function page<T>(items: T[], query: { page: number; pageSize: number }): Paginated<T> {
  const start = (query.page - 1) * query.pageSize;
  return toPaginated(items.slice(start, start + query.pageSize), items.length, query.page, query.pageSize);
}

/**
 * Kho tài liệu dạng thư mục: Dự án → Công việc → File. Mọi cấp đều lọc theo quyền xem dự án
 * (ProjectAccessService); số file/dung lượng đếm bằng truy vấn gộp (GROUP BY) trong DB, không tải danh sách file lên để đếm.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly attachments: AttachmentsService,
  ) {}

  // ---------------------------------------------------------- cấp 1: dự án

  async listProjects(user: AuthUser, query: FolderQueryDto) {
    const projects = await this.prisma.project.findMany({
      where: { AND: [this.access.visibleProjectWhere(user), query.search ? { name: { contains: query.search } } : {}] },
      select: { id: true, name: true, createdById: true },
    });
    const stats = await this.projectStats(projects.map((p) => p.id));
    const items = projects
      .map((p) => ({ id: p.id, name: p.name, ...(stats.get(p.id) ?? NO_FILES) }))
      .sort(folderComparator(query.sortBy, query.order));
    return page(items, query);
  }

  // ----------------------------------------------------- cấp 2: trong dự án

  async getProject(user: AuthUser, projectId: number, query: FolderQueryDto) {
    const project = await this.access.assertCanView(user, projectId);

    const [common, perTask] = await Promise.all([
      this.prisma.attachment.aggregate({ where: { projectId }, _count: { _all: true }, _sum: { size: true }, _max: { createdAt: true } }),
      this.prisma.attachment.groupBy({
        by: ['taskId'],
        where: { task: { projectId } },
        _count: { _all: true },
        _sum: { size: true },
        _max: { createdAt: true },
      }),
    ]);
    const stats = new Map<number, FolderStats>();
    for (const row of perTask) {
      if (row.taskId !== null) stats.set(row.taskId, { fileCount: row._count._all, totalSize: row._sum.size ?? 0, latestAt: row._max.createdAt });
    }

    const titleFilter: Prisma.TaskWhereInput = query.search ? { title: { contains: query.search } } : {};
    const tasks = await this.prisma.task.findMany({
      where: { projectId, ...(query.includeEmpty ? {} : { id: { in: [...stats.keys()] } }), ...titleFilter },
      select: { id: true, title: true, status: { select: STATUS_SELECT }, parentId: true, parent: { select: { id: true, title: true } } },
    });
    const items = tasks
      .map((t) => ({ id: t.id, name: t.title, status: t.status, parent: t.parent, ...(stats.get(t.id) ?? NO_FILES) }))
      .sort(folderComparator(query.sortBy, query.order));

    return {
      project: { id: project.id, name: project.name },
      common: { fileCount: common._count._all, totalSize: common._sum.size ?? 0, latestAt: common._max.createdAt },
      /** Chỉ leader của dự án / admin tải lên file chung của dự án */
      canUpload: this.access.canManage(user, project),
      ...page(items, query),
    };
  }

  /** File chung của dự án (đính trực tiếp vào dự án, không thuộc task nào) */
  async listProjectFiles(user: AuthUser, projectId: number, query: FileListQueryDto) {
    const project = await this.access.assertCanView(user, projectId);
    const paged = await this.pageFiles({ projectId }, query, user);
    return { project: { id: project.id, name: project.name }, canUpload: this.access.canManage(user, project), ...paged };
  }

  // -------------------------------------------------------- cấp 3: trong task

  async getTask(user: AuthUser, taskId: number, query: FileListQueryDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, status: { select: STATUS_SELECT }, projectId: true, project: { select: { name: true } }, parent: { select: { id: true, title: true } } },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    await this.access.assertCanView(user, task.projectId);
    const paged = await this.pageFiles({ taskId }, query, user);
    return {
      task: { id: task.id, title: task.title, status: task.status, projectId: task.projectId, projectName: task.project.name, parent: task.parent },
      /** Mọi thành viên dự án được tải file lên công việc */
      canUpload: true,
      ...paged,
    };
  }

  // ------------------------------------------------------------- tìm kiếm

  /** Tìm file theo tên trên toàn kho (chỉ trong các dự án được xem); mỗi kết quả kèm `project` và `task` để dựng đường dẫn */
  async search(user: AuthUser, query: FileSearchQueryDto) {
    const where: Prisma.AttachmentWhereInput = { AND: [this.attachments.visibleWhere(user), { originalName: { contains: query.q } }] };
    const [rows, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        include: attachmentInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attachment.count({ where }),
    ]);
    return toPaginated(
      rows.map((row) => this.attachments.toView(user, row)),
      total,
      query.page,
      query.pageSize,
    );
  }

  // ---------------------------------------------------------------- helpers

  private async pageFiles(scope: Prisma.AttachmentWhereInput, query: FileListQueryDto, user: AuthUser) {
    const where: Prisma.AttachmentWhereInput = { AND: [scope, query.search ? { originalName: { contains: query.search } } : {}] };
    const field = query.sortBy === 'name' ? 'originalName' : query.sortBy === 'size' ? 'size' : 'createdAt';
    const [rows, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        include: attachmentInclude,
        orderBy: [{ [field]: query.order }, { id: query.order }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attachment.count({ where }),
    ]);
    return toPaginated(
      rows.map((row) => this.attachments.toView(user, row)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Số file / dung lượng / file mới nhất của từng dự án (file của dự án + file của mọi task trong dự án) bằng MỘT truy vấn GROUP BY */
  private async projectStats(projectIds: number[]): Promise<Map<number, FolderStats>> {
    const result = new Map<number, FolderStats>();
    if (projectIds.length === 0) return result;
    const rows = await this.prisma.$queryRaw<ProjectStatsRow[]>(Prisma.sql`
      SELECT COALESCE(a.projectId, t.projectId) AS id,
             CAST(COUNT(*) AS UNSIGNED) AS fileCount,
             CAST(COALESCE(SUM(a.size), 0) AS UNSIGNED) AS totalSize,
             MAX(a.createdAt) AS latestAt
      FROM Attachment a
      LEFT JOIN Task t ON t.id = a.taskId
      WHERE COALESCE(a.projectId, t.projectId) IN (${Prisma.join(projectIds)})
      GROUP BY COALESCE(a.projectId, t.projectId)
    `);
    for (const row of rows) {
      result.set(Number(row.id), { fileCount: Number(row.fileCount), totalSize: Number(row.totalSize ?? 0), latestAt: row.latestAt });
    }
    return result;
  }
}
