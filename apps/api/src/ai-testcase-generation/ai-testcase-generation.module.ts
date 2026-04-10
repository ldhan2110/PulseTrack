// apps/api/src/ai-testcase-generation/ai-testcase-generation.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiTestCaseGenerationController } from './ai-testcase-generation.controller';
import { AiTestCaseGenerationService } from './ai-testcase-generation.service';
import { AiTestCaseGenerationProcessor } from './ai-testcase-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-testcase-generation' }),
  ],
  controllers: [AiTestCaseGenerationController],
  providers: [AiTestCaseGenerationService, AiTestCaseGenerationProcessor],
})
export class AiTestCaseGenerationModule {}
