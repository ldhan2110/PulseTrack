import { Module } from '@nestjs/common';
import { PlannerController } from './planner.controller';
import { PlannerChatController } from './planner-chat.controller';
import { PlannerService } from './planner.service';
import { PlannerChatService } from './planner-chat.service';
import { PlannerAiService } from './planner-ai.service';

@Module({
  controllers: [PlannerController, PlannerChatController],
  providers: [PlannerService, PlannerChatService, PlannerAiService],
  exports: [PlannerService],
})
export class PlannerModule {}
