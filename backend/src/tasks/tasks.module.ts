import { Module } from '@nestjs/common';
import { StorageModule } from '../attachments/storage.module';
import { AutomationModule } from '../automation/automation.module';
import { ProjectsModule } from '../projects/projects.module';
import { StatusesModule } from '../statuses/statuses.module';
import { TasksController } from './tasks.controller';
import { TaskDependenciesService } from './task-dependencies.service';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProjectsModule, StatusesModule, StorageModule, AutomationModule],
  controllers: [TasksController],
  providers: [TasksService, TaskDependenciesService],
  exports: [TasksService],
})
export class TasksModule {}
