import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiBugFixService } from './ai-bug-fix.service';
import { AiBugFixProcessor } from './ai-bug-fix.processor';
import { AiBugFixCleanupService } from './ai-bug-fix.cleanup.service';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-bug-fix' }),
  ],
  providers: [AiBugFixService, AiBugFixProcessor, AiBugFixCleanupService],
  exports: [AiBugFixService, AiBugFixProcessor, BullModule],
})
export class AiBugFixModule {}
