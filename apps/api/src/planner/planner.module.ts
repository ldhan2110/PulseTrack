import { Module } from '@nestjs/common';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';
import { PlannerChatController } from './planner-chat.controller';
import { PlannerChatService } from './planner-chat.service';

@Module({
  controllers: [PlannerController, PlannerChatController],
  providers: [PlannerService, PlannerChatService],
  exports: [PlannerService],
})
export class PlannerModule {}
