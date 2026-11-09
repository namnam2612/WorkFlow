import { Module } from '@nestjs/common';
import { LeavesModule } from '../leaves/leaves.module';
import { ProjectsModule } from '../projects/projects.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [ProjectsModule, LeavesModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class PlanningModule {}
