import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitLabProvider } from './gitlab.provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GitLabProvider', () => {
  let provider: GitLabProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GitLabProvider();
  });

  describe('createBranch', () => {
    it('calls GitLab API to create a branch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ default_branch: 'main' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'feat/PM-1-test' }),
      });

      await provider.createBranch({
        repoUrl: 'https://gitlab.company.com/team/project.git',
        token: 'glpat-abc123',
        branchName: 'feat/PM-1-test',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://gitlab.company.com/api/v4/projects/team%2Fproject',
      );
      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://gitlab.company.com/api/v4/projects/team%2Fproject/repository/branches',
      );
    });

    it('uses provided sourceBranch instead of default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'feat/PM-1-test' }),
      });

      await provider.createBranch({
        repoUrl: 'https://gitlab.company.com/team/project.git',
        token: 'glpat-abc123',
        branchName: 'feat/PM-1-test',
        sourceBranch: 'develop',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Branch already exists' }),
      });

      await expect(
        provider.createBranch({
          repoUrl: 'https://gitlab.company.com/team/project.git',
          token: 'glpat-abc123',
          branchName: 'feat/PM-1-test',
          sourceBranch: 'main',
        }),
      ).rejects.toThrow('GitLab API error (400): Branch already exists');
    });
  });

  describe('createPr', () => {
    it('creates a merge request and returns url + number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            iid: 42,
            web_url: 'https://gitlab.company.com/team/project/-/merge_requests/42',
          }),
      });

      const result = await provider.createPr({
        repoUrl: 'https://gitlab.company.com/team/project.git',
        token: 'glpat-abc123',
        title: 'feat(PM-1): add feature',
        description: 'Description here',
        sourceBranch: 'feat/PM-1-test',
        targetBranch: 'develop',
      });

      expect(result).toEqual({
        prUrl: 'https://gitlab.company.com/team/project/-/merge_requests/42',
        prNumber: 42,
      });
    });
  });
});
