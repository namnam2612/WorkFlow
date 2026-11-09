import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ProjectsModule } from '../projects/projects.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [ProjectsModule, AttachmentsModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
