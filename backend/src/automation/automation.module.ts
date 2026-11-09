import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [ProjectsModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
