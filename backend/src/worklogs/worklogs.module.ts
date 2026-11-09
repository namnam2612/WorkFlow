import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WorkLogsController } from './worklogs.controller';
import { WorkLogsService } from './worklogs.service';

@Module({
  imports: [ProjectsModule],
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
})
export class WorkLogsModule {}
