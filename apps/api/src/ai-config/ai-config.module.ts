import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';
import { AiContextGeneratorService } from './ai-context-generator.service';

@Module({
  controllers: [AiConfigController],
  providers: [AiConfigService, AiContextGeneratorService],
  exports: [AiConfigService],
})
export class AiConfigModule {}
