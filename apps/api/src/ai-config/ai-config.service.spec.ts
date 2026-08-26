import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiConfigService } from './ai-config.service';
import { NotFoundException } from '@nestjs/common';

describe('AiConfigService', () => {
  let service: AiConfigService;
  const ENCRYPTION_KEY = 'a'.repeat(64);

  const mockPrisma = {
    aiConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    repository: {
      findMany: vi.fn(),
    },
  };

  const mockConfig = {
    get: vi.fn().mockReturnValue(ENCRYPTION_KEY),
    getOrThrow: vi.fn().mockReturnValue(ENCRYPTION_KEY),
  };

  const mockQueue = {
    add: vi.fn(),
    getJob: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiConfigService(mockPrisma as any, mockConfig as any, mockQueue as any);
  });

  describe('findByProjectId', () => {
    it('returns config with masked API key when found', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        id: 'ac-1',
        projectId: 'proj-1',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        apiKey: 'encrypted-value',
        projectContext: 'Some context',
      });

      const result = await service.findByProjectId('proj-1');
      expect(result).toBeDefined();
      expect(result!.apiKey).toContain('****');
      expect(result!.projectContext).toBe('Some context');
    });

    it('returns null when not found', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue(null);
      const result = await service.findByProjectId('proj-1');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('encrypts API key and saves config', async () => {
      const dto = {
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-ant-secret',
        projectContext: 'NestJS monorepo',
      };
      const saved = { id: 'ac-1', projectId: 'proj-1', ...dto, apiKey: 'encrypted' };
      mockPrisma.aiConfig.upsert.mockResolvedValue(saved);

      const result = await service.upsert('proj-1', dto);

      expect(result.apiKey).toContain('****');
      expect(result.provider).toBe('claude');
      expect(mockPrisma.aiConfig.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('updateContext', () => {
    it('throws NotFoundException when config does not exist', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue(null);
      await expect(service.updateContext('proj-1', 'New context')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateContext', () => {
    it('enqueues with a deterministic per-project jobId and returns it', async () => {
      mockQueue.add.mockResolvedValue({ id: 'ctx-proj-1' });

      const result = await service.generateContext('proj-1');

      expect(result.jobId).toBe('ctx-proj-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'generate',
        { projectId: 'proj-1' },
        { jobId: 'ctx-proj-1', removeOnComplete: true, removeOnFail: true },
      );
    });

    it('re-enqueue while active resolves to the same jobId (dedup)', async () => {
      // BullMQ keeps the existing job when the deterministic id is already present;
      // add() resolves to that same job, so the returned jobId is stable.
      mockQueue.add.mockResolvedValue({ id: 'ctx-proj-1' });

      const first = await service.generateContext('proj-1');
      const second = await service.generateContext('proj-1');

      expect(first.jobId).toBe('ctx-proj-1');
      expect(second.jobId).toBe('ctx-proj-1');
    });
  });

  describe('getContextJobResult', () => {
    it('returns active status with the latest step', async () => {
      mockQueue.getJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue('active'),
        progress: { step: '🔍 Scanning the repository…' },
      });

      const r = await service.getContextJobResult('ctx-proj-1');
      expect(r).toEqual({ status: 'active', step: '🔍 Scanning the repository…' });
    });

    it('reports a removed (finished) job as not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      const r = await service.getContextJobResult('ctx-proj-1');
      expect(r.status).toBe('failed');
    });
  });
});
