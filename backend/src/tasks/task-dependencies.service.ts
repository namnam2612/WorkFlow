import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { wouldCreateCycle } from './dependencies';

/** Phụ thuộc "kết thúc → bắt đầu" giữa các công việc cùng dự án; chỉ leader dự án / admin chỉnh sửa */
@Injectable()
export class TaskDependenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeService,
  ) {}

  async add(user: AuthUser, taskId: number, dependsOnId: number): Promise<void> {
    const [task, other] = await Promise.all([this.findTask(taskId), this.findTask(dependsOnId)]);
    await this.access.assertCanManage(user, task.projectId);
    if (taskId === dependsOnId) throw new BadRequestException('Một công việc không thể phụ thuộc vào chính nó');
    if (other.projectId !== task.projectId) throw new BadRequestException('Chỉ tạo phụ thuộc giữa các công việc cùng dự án');
    if (task.type === 'epic' || other.type === 'epic') throw new BadRequestException('Epic không có phụ thuộc');
    const edges = await this.prisma.taskDependency.findMany({ where: { task: { projectId: task.projectId } }, select: { taskId: true, dependsOnId: true } });
    if (edges.some((e) => e.taskId === taskId && e.dependsOnId === dependsOnId)) throw new ConflictException('Phụ thuộc này đã tồn tại');
    if (wouldCreateCycle(edges, taskId, dependsOnId)) throw new BadRequestException('Phụ thuộc này tạo vòng lặp (các việc chờ nhau)');
    await this.prisma.taskDependency.create({ data: { taskId, dependsOnId } });
    await this.activity.log({ taskId, userId: user.id, action: 'dependency_changed', detail: { added: { id: other.id, title: other.title } } });
    this.realtime.taskChanged(task.projectId, taskId);
  }

  async remove(user: AuthUser, taskId: number, dependsOnId: number): Promise<void> {
    const task = await this.findTask(taskId);
    await this.access.assertCanManage(user, task.projectId);
    const edge = await this.prisma.taskDependency.findUnique({ where: { taskId_dependsOnId: { taskId, dependsOnId } } });
    if (!edge) throw new NotFoundException('Không tìm thấy phụ thuộc');
    const other = await this.prisma.task.findUnique({ where: { id: dependsOnId }, select: { id: true, title: true } });
    await this.prisma.taskDependency.delete({ where: { taskId_dependsOnId: { taskId, dependsOnId } } });
    await this.activity.log({ taskId, userId: user.id, action: 'dependency_changed', detail: { removed: { id: dependsOnId, title: other?.title ?? '' } } });
    this.realtime.taskChanged(task.projectId, taskId);
  }

  private async findTask(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id }, select: { id: true, title: true, projectId: true, type: true } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }
}
