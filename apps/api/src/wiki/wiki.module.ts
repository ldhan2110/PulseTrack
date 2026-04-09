import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';
import { WikiConfigModule } from '../wiki-config/wiki-config.module';

@Module({
  imports: [
    WikiConfigModule,
    BullModule.registerQueue({ name: 'wiki-generation' }),
  ],
  controllers: [WikiController],
  providers: [WikiService],
  exports: [WikiService],
})
export class WikiModule {}
