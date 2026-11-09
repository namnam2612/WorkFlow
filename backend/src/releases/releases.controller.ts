import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateReleaseDto, PublishReleaseDto, UpdateReleaseDto } from './dto/release.dto';
import { ReleasesService } from './releases.service';

/** Xem: thành viên dự án. Tạo/sửa/xóa/phát hành: leader của dự án hoặc admin (kiểm tra trong service). */
@Controller()
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get('projects/:projectId/releases')
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.releases.list(user, projectId);
  }

  @Post('projects/:projectId/releases')
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateReleaseDto) {
    return this.releases.create(user, projectId, dto);
  }

  @Get('releases/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.releases.get(user, id);
  }

  @Patch('releases/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReleaseDto) {
    return this.releases.update(user, id, dto);
  }

  @Delete('releases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.releases.remove(user, id);
  }

  @Post('releases/:id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PublishReleaseDto) {
    return this.releases.publish(user, id, dto.force === true);
  }
}
