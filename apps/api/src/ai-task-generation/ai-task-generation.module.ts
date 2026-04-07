import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiTaskGenerationController } from './ai-task-generation.controller';
import { AiTaskGenerationService } from './ai-task-generation.service';
import { AiTaskGenerationProcessor } from './ai-task-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-task-generation' }),
  ],
  controllers: [AiTaskGenerationController],
  providers: [AiTaskGenerationService, AiTaskGenerationProcessor],
})
export class AiTaskGenerationModule {}
