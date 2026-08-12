import { Injectable, NotFoundException } from '@nestjs/common';
import type { Agent } from './agent.interface';
import { TestcaseScriptAgent } from './specialist/testcase-script.agent';

@Injectable()
export class AgentsService {
  private readonly registry = new Map<string, Agent>();

  constructor(testcaseScript: TestcaseScriptAgent) {
    this.register(testcaseScript);
  }

  private register(agent: Agent) {
    this.registry.set(agent.kind, agent);
  }

  run(kind: string, ctx: unknown): Promise<unknown> {
    const agent = this.registry.get(kind);
    if (!agent) throw new NotFoundException(`Unknown agent kind: ${kind}`);
    return agent.run(ctx);
  }
}
