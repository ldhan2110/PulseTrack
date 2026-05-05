import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiBugFixService } from './ai-bug-fix.service';
import { AiBugFixProcessor } from './ai-bug-fix.processor';
import { AiBugFixCleanupService } from './ai-bug-fix.cleanup.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    NotificationsModule,
    BranchesModule,
    BullModule.registerQueue({ name: 'ai-bug-fix' }),
  ],
  providers: [AiBugFixService, AiBugFixProcessor, AiBugFixCleanupService],
  exports: [AiBugFixService, AiBugFixProcessor],
})
export class AiBugFixModule {}
