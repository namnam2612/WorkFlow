import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [ProjectsModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
