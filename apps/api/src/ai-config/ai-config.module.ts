import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';
import { AiConfigContextProcessor } from './ai-config-context.processor';
import { AgentsModule } from '../agents/agents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-project-context' }),
    AgentsModule,
    NotificationsModule,
  ],
  controllers: [AiConfigController],
  providers: [AiConfigService, AiConfigContextProcessor],
  exports: [AiConfigService],
})
export class AiConfigModule {}
