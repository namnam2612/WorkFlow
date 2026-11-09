import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ProjectsModule } from '../projects/projects.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [ProjectsModule, AttachmentsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
