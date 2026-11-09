import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateGuestLinkDto } from './dto/portal.dto';
import { PortalService } from './portal.service';

@Controller()
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('projects/:projectId/guest-links')
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.portal.list(user, projectId);
  }

  @Post('projects/:projectId/guest-links')
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateGuestLinkDto) {
    return this.portal.create(user, projectId, dto);
  }

  @Delete('guest-links/:id')
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.portal.revoke(user, id);
  }

  /** Công khai, không cần đăng nhập; giới hạn 30 lượt/phút/IP để chống dò token */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/portal/:token')
  view(@Param('token') token: string) {
    return this.portal.view(token);
  }
}
