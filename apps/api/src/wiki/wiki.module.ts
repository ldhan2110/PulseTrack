import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';
import { WikiGenerationProcessor } from '../wiki-generation/wiki-generation.processor';
import { AgentsModule } from '../agents/agents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'wiki-generation' }),
    AgentsModule,
    NotificationsModule,
  ],
  controllers: [WikiController],
  providers: [WikiService, WikiGenerationProcessor],
  exports: [WikiService],
})
export class WikiModule {}
