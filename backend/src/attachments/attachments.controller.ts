import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Res, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AttachmentsService, IncomingFile, MAX_FILES_PER_UPLOAD } from './attachments.service';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { contentDisposition } from './file-types';

/** Quyền xem/tải/xóa kiểm tra trong AttachmentsService theo dự án chứa file (trực tiếp hoặc qua công việc) */
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('tasks/:taskId/attachments')
  listForTask(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number) {
    return this.attachments.listForTask(user, taskId);
  }

  @Post('tasks/:taskId/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD))
  upload(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number, @UploadedFiles() files: IncomingFile[] | undefined) {
    return this.attachments.uploadToTask(user, taskId, files);
  }

  @Get('projects/:projectId/attachments')
  listForProject(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number) {
    return this.attachments.listForProject(user, projectId);
  }

  /** Chỉ leader của dự án / admin (kiểm tra trong service) */
  @Post('projects/:projectId/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD))
  uploadToProject(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @UploadedFiles() files: IncomingFile[] | undefined) {
    return this.attachments.uploadToProject(user, projectId, files);
  }

  /** Kho tài liệu */
  @Get('attachments')
  list(@CurrentUser() user: AuthUser, @Query() query: ListAttachmentsQueryDto) {
    return this.attachments.list(user, query);
  }

  @Get('attachments/:id/download')
  async download(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const file = await this.attachments.openDownload(user, id);
    res.set({
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': contentDisposition('attachment', file.name),
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(file.stream);
  }

  @Get('attachments/:id/preview')
  async preview(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const file = await this.attachments.openPreview(user, id);
    res.set({
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': contentDisposition('inline', file.name),
      // Nội dung do người dùng tải lên: cấm chạy script/nhúng tài nguyên dù bị mở trực tiếp
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(file.stream);
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.attachments.remove(user, id);
  }
}
