import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CalendarQueryDto } from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller()
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query() query: CalendarQueryDto) {
    return this.schedule.calendar(user, query);
  }

  @Get('projects/:projectId/gantt')
  gantt(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.schedule.gantt(user, projectId);
  }
}
