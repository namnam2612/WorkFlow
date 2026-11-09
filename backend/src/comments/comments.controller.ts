import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tasks/:taskId/comments')
  list(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number) {
    return this.comments.list(user, taskId);
  }

  @Post('tasks/:taskId/comments')
  create(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number, @Body() dto: CreateCommentDto) {
    return this.comments.create(user, taskId, dto.content);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.comments.remove(user, id);
  }
}
