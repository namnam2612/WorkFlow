import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto, UpdateTeamMemberDto } from './dto/team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.teams.list(user);
  }

  @Post()
  @Roles('admin', 'leader')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teams.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.teams.get(user, id);
  }

  @Patch(':id')
  @Roles('admin', 'leader')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.teams.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'leader')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.teams.remove(user, id);
  }

  @Post(':id/members')
  @Roles('admin', 'leader')
  addMember(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AddTeamMemberDto) {
    return this.teams.addMember(user, id, dto);
  }

  @Patch(':id/members/:userId')
  @Roles('admin', 'leader')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teams.updateMember(user, id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @Roles('admin', 'leader')
  removeMember(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) {
    return this.teams.removeMember(user, id, userId);
  }
}
