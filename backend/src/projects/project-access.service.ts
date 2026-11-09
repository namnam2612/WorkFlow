import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export interface ProjectRef {
  id: number;
  name: string;
  createdById: number;
}

/** Quy tắc truy cập dự án dùng chung cho Projects/Tasks/Comments/Dashboard */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** admin hoặc leader là người tạo dự án */
  canManage(user: AuthUser, project: Pick<ProjectRef, 'createdById'>): boolean {
    return user.role === 'admin' || (user.role === 'leader' && project.createdById === user.id);
  }

  /** Điều kiện Prisma giới hạn các dự án người dùng được xem; admin xem tất cả */
  visibleProjectWhere(user: AuthUser): Prisma.ProjectWhereInput {
    if (user.role === 'admin') return {};
    return { OR: [{ members: { some: { userId: user.id } } }, { createdById: user.id }] };
  }

  async getProjectOrThrow(projectId: number): Promise<ProjectRef> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, createdById: true },
    });
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    return project;
  }

  async assertCanView(user: AuthUser, projectId: number): Promise<ProjectRef> {
    const project = await this.getProjectOrThrow(projectId);
    if (user.role === 'admin' || project.createdById === user.id) return project;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!membership) throw new ForbiddenException('Bạn không thuộc dự án này');
    return project;
  }

  async assertCanManage(user: AuthUser, projectId: number): Promise<ProjectRef> {
    const project = await this.getProjectOrThrow(projectId);
    if (!this.canManage(user, project)) {
      throw new ForbiddenException('Chỉ trưởng nhóm của dự án hoặc quản trị viên mới có quyền này');
    }
    return project;
  }

  async isMember(projectId: number, userId: number): Promise<boolean> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return membership !== null;
  }

  /** Danh sách id dự án được xem; null = tất cả (admin) */
  async visibleProjectIds(user: AuthUser): Promise<number[] | null> {
    if (user.role === 'admin') return null;
    const projects = await this.prisma.project.findMany({ where: this.visibleProjectWhere(user), select: { id: true } });
    return projects.map((p) => p.id);
  }
}
