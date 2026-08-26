import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryConfigService } from './repository-config.service';
import { NotFoundException } from '@nestjs/common';

describe('RepositoryConfigService', () => {
  let service: RepositoryConfigService;
  const ENCRYPTION_KEY = 'a'.repeat(64);

  const mockPrisma = {
    repositoryConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockQueue = {
    add: vi.fn(),
  };

  const mockNotifications = {
    notifyProject: vi.fn(),
  };

  const mockConfig = {
    get: vi.fn().mockReturnValue(ENCRYPTION_KEY),
    getOrThrow: vi.fn().mockReturnValue(ENCRYPTION_KEY),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RepositoryConfigService(
      mockPrisma as any,
      mockQueue as any,
      mockQueue as any,
      mockNotifications as any,
      mockConfig as any,
    );
  });

  describe('findByProjectId', () => {
    it('returns config with masked token when found', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue({
        id: 'rc-1',
        projectId: 'proj-1',
        repoUrl: 'https://gitlab.com/repo.git',
        accessToken: 'encrypted-value',
        cloneStatus: 'cloned',
        cloneError: null,
        workspacePath: 'workspaces/proj-1',
      });

      const result = await service.findByProjectId('proj-1');
      expect(result).toBeDefined();
      expect(result!.accessToken).not.toBe('encrypted-value');
      expect(result!.accessToken).toContain('****');
      expect(mockPrisma.repositoryConfig.findUnique).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(null);
      const result = await service.findByProjectId('proj-1');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('encrypts token and enqueues clone job', async () => {
      const dto = { repoUrl: 'https://gitlab.com/repo.git', accessToken: 'glpat-secret123' };
      const saved = {
        id: 'rc-1',
        projectId: 'proj-1',
        repoUrl: dto.repoUrl,
        accessToken: 'encrypted',
        cloneStatus: 'cloning',
        cloneError: null,
        workspacePath: null,
      };
      mockPrisma.repositoryConfig.upsert.mockResolvedValue(saved);
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await service.upsert('proj-1', dto);

      expect(result.cloneStatus).toBe('cloning');
      expect(result.accessToken).toContain('****');
      expect(mockPrisma.repositoryConfig.upsert).toHaveBeenCalledOnce();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'clone',
        { projectId: 'proj-1' },
        expect.any(Object),
      );
    });
  });

  describe('remove', () => {
    it('deletes config and returns void', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue({ id: 'rc-1', projectId: 'proj-1' });
      mockPrisma.repositoryConfig.delete.mockResolvedValue({});
      await service.remove('proj-1');
      expect(mockPrisma.repositoryConfig.delete).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
      });
    });

    it('throws NotFoundException when config does not exist', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(null);
      await expect(service.remove('proj-1')).rejects.toThrow(NotFoundException);
    });
  });
});
