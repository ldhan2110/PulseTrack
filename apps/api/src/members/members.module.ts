import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
