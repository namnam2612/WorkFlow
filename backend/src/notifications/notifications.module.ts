import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SlackService } from './slack.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MailService, SlackService],
  exports: [NotificationsService, SlackService],
})
export class NotificationsModule {}
