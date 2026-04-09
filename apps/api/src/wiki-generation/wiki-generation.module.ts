import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WikiGenerationController } from './wiki-generation.controller';
import { WikiGenerationService } from './wiki-generation.service';
import { WikiGenerationProcessor } from './wiki-generation.processor';
import { WikiConfigModule } from '../wiki-config/wiki-config.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    WikiConfigModule,
    BullModule.registerQueue({ name: 'wiki-generation' }),
  ],
  controllers: [WikiGenerationController],
  providers: [WikiGenerationService, WikiGenerationProcessor],
  exports: [WikiGenerationService],
})
export class WikiGenerationModule {}
