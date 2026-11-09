import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { CommentsModule } from './comments/comments.module';
import { LeavesModule } from './leaves/leaves.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PlanningModule } from './schedule/schedule.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { QaModule } from './qa/qa.module';
import { ReleasesModule } from './releases/releases.module';
import { SprintsModule } from './sprints/sprints.module';
import { StatusesModule } from './statuses/statuses.module';
import { TasksModule } from './tasks/tasks.module';
import { TeamsModule } from './teams/teams.module';
import { SearchModule } from './search/search.module';
import { WikiModule } from './wiki/wiki.module';
import { UsersModule } from './users/users.module';
import { WorkLogsModule } from './worklogs/worklogs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    ActivityModule,
    NotificationsModule,
    RealtimeModule,
    SchedulerModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    StatusesModule,
    SprintsModule,
    WorkLogsModule,
    TeamsModule,
    LeavesModule,
    PlanningModule,
    ReleasesModule,
    QaModule,
    WikiModule,
    SearchModule,
    TasksModule,
    CommentsModule,
    AttachmentsModule,
    FilesModule,
    DashboardModule,
  ],
  providers: [
    // Thứ tự quan trọng: throttle -> xác thực JWT -> kiểm tra vai trò
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
