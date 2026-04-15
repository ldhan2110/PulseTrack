import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationEmailProcessor } from './notification-email.processor';
import { NotificationEmailService } from './notification-email.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
  ],
  providers: [NotificationEmailProcessor, NotificationEmailService],
  exports: [NotificationEmailService],
})
export class NotificationEmailModule {}
