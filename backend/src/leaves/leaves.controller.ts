import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CapacityQueryDto, CreateLeaveDto, ListLeavesQueryDto, ReviewLeaveDto } from './dto/leave.dto';
import { LeavesService } from './leaves.service';

@Controller()
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Get('leaves')
  list(@CurrentUser() user: AuthUser, @Query() query: ListLeavesQueryDto) {
    return this.leaves.list(user, query);
  }

  @Post('leaves')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveDto) {
    return this.leaves.create(user, dto);
  }

  @Post('leaves/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.leaves.cancel(user, id);
  }

  @Post('leaves/:id/review')
  review(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewLeaveDto) {
    return this.leaves.review(user, id, dto);
  }

  @Get('projects/:projectId/capacity')
  capacity(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: CapacityQueryDto) {
    return this.leaves.capacityForProject(user, projectId, query.from, query.to);
  }
}
