import { Injectable, NotFoundException } from '@nestjs/common';
import type { Agent } from './agent.interface';
import { TestcaseScriptAgent } from './specialist/testcase-script.agent';
import { ProjectContextAgent } from './specialist/project-context.agent';
import { BaUserStoryAgent } from './specialist/ba-user-story.agent';

@Injectable()
export class AgentsService {
  private readonly registry = new Map<string, Agent>();

  constructor(
    testcaseScript: TestcaseScriptAgent,
    projectContext: ProjectContextAgent,
    baUserStory: BaUserStoryAgent,
  ) {
    this.register(testcaseScript);
    this.register(projectContext);
    this.register(baUserStory);
  }

  private register(agent: Agent) {
    this.registry.set(agent.kind, agent);
  }

  run(kind: string, ctx: unknown, onStep?: (line: string) => void): Promise<unknown> {
    const agent = this.registry.get(kind);
    if (!agent) throw new NotFoundException(`Unknown agent kind: ${kind}`);
    return agent.run(ctx, onStep);
  }
}
