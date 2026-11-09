import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ProjectsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
