import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchesService } from './branches.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

vi.mock('../common/encryption.util', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-token'),
}));

describe('BranchesService', () => {
  let service: BranchesService;
  const ENCRYPTION_KEY = 'a'.repeat(64);

  const mockPrisma = {
    repositoryConfig: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    taskBranch: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: { findUnique: vi.fn() },
  };

  const mockGitProvider = {
    createBranch: vi.fn(),
    createPr: vi.fn(),
  };

  const mockFactory = {
    create: vi.fn().mockReturnValue(mockGitProvider),
  };

  const mockConfig = {
    getOrThrow: vi.fn().mockReturnValue(ENCRYPTION_KEY),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BranchesService(
      mockPrisma as any,
      mockFactory as any,
      mockConfig as any,
    );
  });

  describe('generateBranchName', () => {
    it('generates branch name from task key and title', () => {
      const name = (service as any).slugify('Add user authentication');
      expect(name).toBe('add-user-authentication');
    });

    it('strips special characters from slug', () => {
      const name = (service as any).slugify('Fix: bug #123 (urgent!)');
      expect(name).toBe('fix-bug-123-urgent');
    });
  });

  describe('createBranch', () => {
    const repoConfig = {
      repoUrl: 'https://gitlab.company.com/team/project.git',
      accessToken: 'encrypted-token',
      provider: 'gitlab',
      cloneStatus: 'cloned',
    };

    const task = {
      id: 'task-1',
      taskKey: 'PM-42',
      title: 'Add user authentication',
      projectId: 'proj-1',
      project: { prefix: 'PM' },
    };

    it('creates a branch with correct naming pattern', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(repoConfig);
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.taskBranch.count.mockResolvedValue(0);
      mockPrisma.taskBranch.create.mockResolvedValue({
        id: 'tb-1',
        branchName: 'feat/PM-42-add-user-authentication',
        branchType: 'feat',
        sequence: 1,
      });

      const result = await service.createBranch('proj-1', 'task-1', {
        branchType: 'feat',
      });

      expect(mockGitProvider.createBranch).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: 'feat/PM-42-add-user-authentication',
        }),
      );
      expect(result.branchName).toBe('feat/PM-42-add-user-authentication');
    });

    it('appends sequence number for duplicate branches', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(repoConfig);
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.taskBranch.count.mockResolvedValue(2);
      mockPrisma.taskBranch.create.mockResolvedValue({
        id: 'tb-3',
        branchName: 'feat/PM-42-add-user-authentication-3',
        branchType: 'feat',
        sequence: 3,
      });

      const result = await service.createBranch('proj-1', 'task-1', {
        branchType: 'feat',
      });

      expect(mockGitProvider.createBranch).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: 'feat/PM-42-add-user-authentication-3',
        }),
      );
    });

    it('throws if repository is not configured', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.createBranch('proj-1', 'task-1', { branchType: 'feat' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if task not found', async () => {
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(repoConfig);
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.createBranch('proj-1', 'task-1', { branchType: 'feat' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPr', () => {
    it('creates a PR with auto-populated title and description', async () => {
      const branch = {
        id: 'tb-1',
        taskId: 'task-1',
        projectId: 'proj-1',
        branchName: 'feat/PM-42-add-user-auth',
        branchType: 'feat',
        task: {
          taskKey: 'PM-42',
          title: 'Add user authentication',
          description: 'Implement login flow',
          acceptanceCriteria: null,
        },
      };
      const repoConfig = {
        repoUrl: 'https://gitlab.company.com/team/project.git',
        accessToken: 'encrypted-token',
        provider: 'gitlab',
      };

      mockPrisma.taskBranch.findUnique.mockResolvedValue(branch);
      mockPrisma.repositoryConfig.findUnique.mockResolvedValue(repoConfig);
      mockGitProvider.createPr.mockResolvedValue({
        prUrl: 'https://gitlab.company.com/team/project/-/merge_requests/5',
        prNumber: 5,
      });
      mockPrisma.taskBranch.update.mockResolvedValue({
        ...branch,
        prUrl: 'https://gitlab.company.com/team/project/-/merge_requests/5',
        prNumber: 5,
        prTitle: 'feat(PM-42): Add user authentication',
        prStatus: 'open',
      });

      const result = await service.createPr('proj-1', {
        branchId: 'tb-1',
        targetBranch: 'develop',
      });

      expect(mockGitProvider.createPr).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'feat(PM-42): Add user authentication',
          sourceBranch: 'feat/PM-42-add-user-auth',
          targetBranch: 'develop',
        }),
      );
      expect(result.prUrl).toBe('https://gitlab.company.com/team/project/-/merge_requests/5');
    });
  });
});
