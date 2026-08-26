import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import type { TestcaseScriptAgent } from './specialist/testcase-script.agent';

describe('AgentsService', () => {
  const stubAgent = {
    kind: 'testcase-script',
    run: vi.fn().mockResolvedValue('script'),
  } as unknown as TestcaseScriptAgent;

  const stubProjectContext = {
    kind: 'project-context',
    run: vi.fn().mockResolvedValue('context'),
  } as unknown as TestcaseScriptAgent;

  const stubBaUserStory = {
    kind: 'ba-user-story',
    run: vi.fn().mockResolvedValue([]),
  } as unknown as TestcaseScriptAgent;

  const service = new AgentsService(stubAgent, stubProjectContext as any, stubBaUserStory as any);

  it('dispatches to the registered agent', async () => {
    await expect(service.run('testcase-script', { a: 1 })).resolves.toBe('script');
    expect(stubAgent.run).toHaveBeenCalledWith({ a: 1 });
  });

  it('throws NotFound on unknown kind', () => {
    expect(() => service.run('nope', {})).toThrow(NotFoundException);
  });
});
