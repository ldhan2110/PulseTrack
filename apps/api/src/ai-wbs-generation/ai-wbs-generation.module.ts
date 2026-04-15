import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiWbsGenerationController } from './ai-wbs-generation.controller';
import { AiWbsGenerationService } from './ai-wbs-generation.service';
import { AiWbsGenerationProcessor } from './ai-wbs-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: 'ai-wbs-generation' })],
  controllers: [AiWbsGenerationController],
  providers: [AiWbsGenerationService, AiWbsGenerationProcessor],
})
export class AiWbsGenerationModule {}
