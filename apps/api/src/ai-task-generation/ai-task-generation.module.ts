import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiTaskGenerationController } from './ai-task-generation.controller';
import { AiTaskGenerationService } from './ai-task-generation.service';
import { AiTaskGenerationProcessor } from './ai-task-generation.processor';
import { AgentsModule } from '../agents/agents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-task-generation' }),
    AgentsModule,
    NotificationsModule,
  ],
  controllers: [AiTaskGenerationController],
  providers: [AiTaskGenerationService, AiTaskGenerationProcessor],
})
export class AiTaskGenerationModule {}
