import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateTestCaseDto, CreateTestRunDto, ExecuteResultDto, UpdateTestCaseDto } from './dto/qa.dto';
import { QaService } from './qa.service';

class CaseListQuery {
  @IsOptional()
  @IsIn(['true', 'false'])
  includeArchived?: string;
}

/** Mọi thành viên dự án (QA/dev) viết test case, tạo đợt chạy và ghi kết quả; xóa/đóng giới hạn theo người tạo hoặc leader */
@Controller()
export class QaController {
  constructor(private readonly qa: QaService) {}

  @Get('projects/:projectId/test-cases')
  listCases(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: CaseListQuery) {
    return this.qa.listCases(user, projectId, query.includeArchived === 'true');
  }

  @Post('projects/:projectId/test-cases')
  createCase(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateTestCaseDto) {
    return this.qa.createCase(user, projectId, dto);
  }

  @Patch('test-cases/:id')
  updateCase(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTestCaseDto) {
    return this.qa.updateCase(user, id, dto);
  }

  @Delete('test-cases/:id')
  removeCase(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.qa.removeCase(user, id);
  }

  @Get('projects/:projectId/test-runs')
  listRuns(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.qa.listRuns(user, projectId);
  }

  @Post('projects/:projectId/test-runs')
  createRun(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateTestRunDto) {
    return this.qa.createRun(user, projectId, dto);
  }

  @Get('test-runs/:id')
  getRun(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.qa.getRun(user, id);
  }

  @Post('test-runs/:id/close')
  closeRun(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.qa.closeRun(user, id);
  }

  @Patch('test-results/:id')
  execute(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ExecuteResultDto) {
    return this.qa.execute(user, id, dto);
  }
}
