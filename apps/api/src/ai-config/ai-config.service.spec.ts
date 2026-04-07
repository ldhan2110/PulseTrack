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
    },
  };

  const mockConfig = {
    get: vi.fn().mockReturnValue(ENCRYPTION_KEY),
    getOrThrow: vi.fn().mockReturnValue(ENCRYPTION_KEY),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiConfigService(mockPrisma as any, mockConfig as any);
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
});
