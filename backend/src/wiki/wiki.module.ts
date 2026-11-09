import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';

@Module({
  imports: [ProjectsModule],
  controllers: [WikiController],
  providers: [WikiService],
  exports: [WikiService],
})
export class WikiModule {}
