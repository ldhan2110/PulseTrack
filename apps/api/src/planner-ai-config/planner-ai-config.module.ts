import { Module } from '@nestjs/common';
import { PlannerAiConfigController } from './planner-ai-config.controller';
import { PlannerAiConfigService } from './planner-ai-config.service';

@Module({
  controllers: [PlannerAiConfigController],
  providers: [PlannerAiConfigService],
  exports: [PlannerAiConfigService],
})
export class PlannerAiConfigModule {}
