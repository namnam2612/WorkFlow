import { Controller, Get, NotFoundException, Param, ParseIntPipe } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ActivityService } from './activity.service';

@Controller('tasks/:taskId/activity')
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    await this.access.assertCanView(user, task.projectId);
    return this.activity.listForTask(taskId);
  }
}
