import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
