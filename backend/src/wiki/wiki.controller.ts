import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateWikiPageDto, UpdateWikiPageDto } from './dto/wiki.dto';
import { API_SPEC_TEMPLATE, WikiService } from './wiki.service';

@Controller()
export class WikiController {
  constructor(private readonly wiki: WikiService) {}

  @Get('projects/:projectId/wiki')
  tree(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.wiki.tree(user, projectId);
  }

  @Post('projects/:projectId/wiki')
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: CreateWikiPageDto) {
    return this.wiki.create(user, projectId, dto);
  }

  /** Mẫu tài liệu API dạng Markdown để người soạn bắt đầu nhanh */
  @Get('wiki-templates/api-spec')
  apiSpecTemplate() {
    return { content: API_SPEC_TEMPLATE };
  }

  @Get('wiki/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.wiki.get(user, id);
  }

  @Patch('wiki/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWikiPageDto) {
    return this.wiki.update(user, id, dto);
  }

  @Delete('wiki/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.wiki.remove(user, id);
  }

  @Get('wiki/:id/revisions')
  revisions(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.wiki.revisions(user, id);
  }

  @Post('wiki/:id/revisions/:revisionId/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('revisionId', ParseIntPipe) revisionId: number) {
    return this.wiki.restore(user, id, revisionId);
  }
}
