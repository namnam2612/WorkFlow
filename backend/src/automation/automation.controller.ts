import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AutomationService } from './automation.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';

/** Xem: thành viên dự án (minh bạch). Tạo/sửa/xóa: leader của dự án hoặc admin. */
@Controller()
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('projects/:projectId/automations')
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.automation.list(user, projectId);
  }

  @Post('projects/:projectId/automations')
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateAutomationDto) {
    return this.automation.create(user, projectId, dto);
  }

  @Patch('automations/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAutomationDto) {
    return this.automation.update(user, id, dto);
  }

  @Delete('automations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.automation.remove(user, id);
  }
}
