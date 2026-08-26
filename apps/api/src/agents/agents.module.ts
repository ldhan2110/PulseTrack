import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { TestcaseScriptAgent } from './specialist/testcase-script.agent';
import { ProjectContextAgent } from './specialist/project-context.agent';
import { BaUserStoryAgent } from './specialist/ba-user-story.agent';

@Module({
  providers: [AgentsService, TestcaseScriptAgent, ProjectContextAgent, BaUserStoryAgent],
  exports: [AgentsService],
})
export class AgentsModule {}
