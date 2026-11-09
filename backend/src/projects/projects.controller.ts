import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProjectsQueryDto) {
    return this.projects.list(user, query.search);
  }

  @Post()
  @Roles('admin', 'leader')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projects.get(user, id);
  }

  @Patch(':id')
  @Roles('admin', 'leader')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projects.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'leader')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.projects.remove(user, id);
  }

  @Post(':id/slack-test')
  @Roles('admin', 'leader')
  testSlack(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projects.testSlack(user, id);
  }

  @Post(':id/members')
  @Roles('admin', 'leader')
  addMember(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AddMemberDto) {
    return this.projects.addMember(user, id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @Roles('admin', 'leader')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.projects.removeMember(user, id, userId);
  }
}
