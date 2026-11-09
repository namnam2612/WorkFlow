import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateStatusDto, DeleteStatusQueryDto, ListStatusesQueryDto, ReorderStatusesDto, UpdateStatusDto } from './dto/status.dto';
import { StatusesService } from './statuses.service';

@Controller('projects/:projectId/statuses')
export class StatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: ListStatusesQueryDto) {
    return this.statuses.list(user, projectId, query.scope);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateStatusDto) {
    return this.statuses.create(user, projectId, dto);
  }

  // Khai báo trước ':statusId' để 'order' không bị hiểu là id
  @Put('order')
  reorder(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: ReorderStatusesDto) {
    return this.statuses.reorder(user, projectId, dto);
  }

  @Patch(':statusId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('statusId', ParseIntPipe) statusId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.statuses.update(user, projectId, statusId, dto);
  }

  @Delete(':statusId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('statusId', ParseIntPipe) statusId: number,
    @Query() query: DeleteStatusQueryDto,
  ): Promise<void> {
    await this.statuses.remove(user, projectId, statusId, query.moveTo);
  }
}
