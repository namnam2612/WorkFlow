import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';

@Module({
  imports: [ProjectsModule],
  controllers: [QaController],
  providers: [QaService],
})
export class QaModule {}
