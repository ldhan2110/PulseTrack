import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SocketAuthService } from './socket-auth.service';

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, SocketAuthService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
