import { Module } from '@nestjs/common';
import { StorageModule } from '../attachments/storage.module';
import { ProjectsModule } from '../projects/projects.module';
import { StatusesModule } from '../statuses/statuses.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProjectsModule, StatusesModule, StorageModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
