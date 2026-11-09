import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateWorkLogDto, TimesheetQueryDto } from './dto/worklog.dto';
import { WorkLogsService } from './worklogs.service';

@Controller()
export class WorkLogsController {
  constructor(private readonly worklogs: WorkLogsService) {}

  @Get('tasks/:taskId/worklogs')
  list(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number) {
    return this.worklogs.list(user, taskId);
  }

  @Post('tasks/:taskId/worklogs')
  add(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number, @Body() dto: CreateWorkLogDto) {
    return this.worklogs.add(user, taskId, dto);
  }

  @Delete('worklogs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.worklogs.remove(user, id);
  }

  @Get('projects/:projectId/timesheet')
  timesheet(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: TimesheetQueryDto) {
    return this.worklogs.timesheet(user, projectId, query.from, query.to);
  }
}
