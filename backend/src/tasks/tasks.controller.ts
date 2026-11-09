import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { BoardQueryDto } from './dto/board-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';
import { TaskDependenciesService } from './task-dependencies.service';
import { AddDependencyDto } from './dto/dependency.dto';

/**
 * Quyền chi tiết (leader của dự án / người được giao) được kiểm tra trong TasksService
 * vì phụ thuộc vào dự án và task cụ thể, không chỉ vai trò toàn hệ thống.
 */
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly dependencies: TaskDependenciesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTasksQueryDto) {
    return this.tasks.list(user, query);
  }

  // Phải khai báo trước ':id' để 'board' / 'my-work' không bị hiểu là id
  @Get('my-work')
  myWork(@CurrentUser() user: AuthUser) {
    return this.tasks.myWork(user);
  }

  @Get('board')
  board(@CurrentUser() user: AuthUser, @Query() query: BoardQueryDto) {
    return this.tasks.board(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tasks.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user, id, dto);
  }

  @Patch(':id/move')
  move(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: MoveTaskDto) {
    return this.tasks.move(user, id, dto);
  }

  @Post(':id/dependencies')
  async addDependency(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AddDependencyDto) {
    await this.dependencies.add(user, id, dto.dependsOnId);
    return this.tasks.get(user, id);
  }

  @Delete(':id/dependencies/:dependsOnId')
  async removeDependency(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('dependsOnId', ParseIntPipe) dependsOnId: number) {
    await this.dependencies.remove(user, id, dependsOnId);
    return this.tasks.get(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tasks.remove(user, id);
  }
}
