import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';
import { WikiGenerationModule } from '../wiki-generation/wiki-generation.module';

@Module({
  imports: [
    forwardRef(() => WikiGenerationModule),
    BullModule.registerQueue({ name: 'wiki-generation' }),
  ],
  controllers: [WikiController],
  providers: [WikiService],
  exports: [WikiService],
})
export class WikiModule {}
