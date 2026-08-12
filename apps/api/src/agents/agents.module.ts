import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { TestcaseScriptAgent } from './specialist/testcase-script.agent';

@Module({
  providers: [AgentsService, TestcaseScriptAgent],
  exports: [AgentsService],
})
export class AgentsModule {}
