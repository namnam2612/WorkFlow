import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { FileListQueryDto, FileSearchQueryDto, FolderQueryDto } from './dto/files-query.dto';
import { FilesService } from './files.service';

/** Kho tài liệu dạng thư mục Dự án → Công việc → File. Quyền xem kiểm tra trong FilesService theo từng dự án. */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Cấp 1: danh sách dự án (kèm số file, dung lượng, file mới nhất) */
  @Get('projects')
  projects(@CurrentUser() user: AuthUser, @Query() query: FolderQueryDto) {
    return this.files.listProjects(user, query);
  }

  /** Tìm file theo tên trên toàn kho. Khai báo trước các route có tham số để không bị nhầm. */
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() query: FileSearchQueryDto) {
    return this.files.search(user, query);
  }

  /** Cấp 2: trong một dự án (file chung + danh sách task) */
  @Get('projects/:projectId')
  project(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: FolderQueryDto) {
    return this.files.getProject(user, projectId, query);
  }

  /** File chung của dự án */
  @Get('projects/:projectId/files')
  projectFiles(@CurrentUser() user: AuthUser, @Param('projectId', ParseIntPipe) projectId: number, @Query() query: FileListQueryDto) {
    return this.files.listProjectFiles(user, projectId, query);
  }

  /** Cấp 3: file trong một task */
  @Get('tasks/:taskId')
  task(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number, @Query() query: FileListQueryDto) {
    return this.files.getTask(user, taskId, query);
  }
}
