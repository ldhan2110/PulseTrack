import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { TestcaseScriptAgent } from './specialist/testcase-script.agent';
import { ProjectContextAgent } from './specialist/project-context.agent';

@Module({
  providers: [AgentsService, TestcaseScriptAgent, ProjectContextAgent],
  exports: [AgentsService],
})
export class AgentsModule {}
