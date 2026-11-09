import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  imports: [ProjectsModule],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
