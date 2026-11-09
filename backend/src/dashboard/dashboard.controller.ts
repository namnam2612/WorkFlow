import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { DashboardQueryDto } from './dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Query() query: DashboardQueryDto) {
    return this.dashboard.get(user, query);
  }
}
