import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { BacklogQueryDto, CompleteSprintDto, CreateSprintDto, MoveToSprintDto, UpdateSprintDto, VelocityQueryDto } from './dto/sprint.dto';
import { SprintsService } from './sprints.service';

/** Quyền: xem = thành viên dự án; tạo/sửa/bắt đầu/kết thúc/xếp việc = leader dự án hoặc admin (kiểm tra trong service) */
@Controller()
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('projects/:projectId/sprints')
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.sprints.list(user, projectId);
  }

  @Post('projects/:projectId/sprints')
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateSprintDto) {
    return this.sprints.create(user, projectId, dto);
  }

  @Get('projects/:projectId/backlog')
  backlog(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: BacklogQueryDto) {
    return this.sprints.backlog(user, projectId, query.includeDone === 'true');
  }

  @Get('projects/:projectId/velocity')
  velocity(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: VelocityQueryDto) {
    return this.sprints.velocity(user, projectId, query.limit ?? 8);
  }

  /** Đưa các việc về backlog */
  @Post('projects/:projectId/backlog/tasks')
  toBacklog(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: MoveToSprintDto) {
    return this.sprints.moveTasks(user, projectId, null, dto.taskIds);
  }

  @Patch('sprints/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSprintDto) {
    return this.sprints.update(user, id, dto);
  }

  @Delete('sprints/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.sprints.remove(user, id);
  }

  @Post('sprints/:id/start')
  start(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sprints.start(user, id);
  }

  @Post('sprints/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CompleteSprintDto) {
    return this.sprints.complete(user, id, dto);
  }

  @Get('sprints/:id/burndown')
  burndown(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sprints.burndown(user, id);
  }

  /** Đưa các việc vào sprint (cần projectId để kiểm tra quyền: lấy từ sprint) */
  @Post('sprints/:id/tasks')
  async addTasks(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: MoveToSprintDto) {
    return this.sprints.addTasksToSprint(user, id, dto.taskIds);
  }
}
