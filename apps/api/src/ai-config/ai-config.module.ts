import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [AiConfigController],
  providers: [AiConfigService],
  exports: [AiConfigService],
})
export class AiConfigModule {}
