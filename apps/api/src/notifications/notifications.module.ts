import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { SocketAuthService } from './socket-auth.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationsGateway, NotificationsService, SocketAuthService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
