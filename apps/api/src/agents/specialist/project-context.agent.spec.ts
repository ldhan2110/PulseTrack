import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectContextAgent } from './project-context.agent';

const mockInvoke = vi.fn();
vi.mock('../ai-client', () => ({
  modelFor: () => ({ invoke: mockInvoke }),
}));
vi.mock('../../ai-config/repo-fingerprint.util', () => ({
  buildRepoFingerprint: vi.fn(async (path: string, name: string) =>
    path ? `### Repository: ${name}` : null,
  ),
}));

describe('ProjectContextAgent', () => {
  let agent: ProjectContextAgent;
  const ENCRYPTION_KEY = 'a'.repeat(64);

  const mockPrisma = {
    aiConfig: { findUnique: vi.fn() },
    repository: { findMany: vi.fn() },
  };
  const mockConfig = { getOrThrow: vi.fn().mockReturnValue(ENCRYPTION_KEY) };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ProjectContextAgent(mockPrisma as any, mockConfig as any);
  });

  it('calls the model once and truncates to 10k', async () => {
    mockPrisma.aiConfig.findUnique.mockResolvedValue({ projectId: 'proj-1', provider: 'claude', model: 'm', apiKey: 'enc' });
    mockPrisma.repository.findMany.mockResolvedValue([{ name: 'api', cloneStatus: 'cloned', workspacePath: '/ws/api' }]);
    mockInvoke.mockResolvedValue({ content: 'x'.repeat(15000) });

    const result = await agent.run({ projectId: 'proj-1' });

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(result).toHaveLength(10000);
  });

  it('throws NotFoundException when no config', async () => {
    mockPrisma.aiConfig.findUnique.mockResolvedValue(null);
    await expect(agent.run({ projectId: 'proj-1' })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when no cloned repos', async () => {
    mockPrisma.aiConfig.findUnique.mockResolvedValue({ projectId: 'proj-1', provider: 'claude', model: 'm', apiKey: 'enc' });
    mockPrisma.repository.findMany.mockResolvedValue([]);
    await expect(agent.run({ projectId: 'proj-1' })).rejects.toThrow(BadRequestException);
  });
});
