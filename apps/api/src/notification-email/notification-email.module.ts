import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationEmailProcessor } from './notification-email.processor';
import { NotificationEmailService } from './notification-email.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  providers: [NotificationEmailProcessor, NotificationEmailService],
  exports: [NotificationEmailService],
})
export class NotificationEmailModule {}
