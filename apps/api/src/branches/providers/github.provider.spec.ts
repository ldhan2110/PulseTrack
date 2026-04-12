import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubProvider } from './github.provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GitHubProvider', () => {
  let provider: GitHubProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GitHubProvider();
  });

  describe('createBranch', () => {
    it('creates a branch via GitHub API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ default_branch: 'main' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: { sha: 'abc123' } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ref: 'refs/heads/feat/PM-1-test' }),
      });

      await provider.createBranch({
        repoUrl: 'https://github.com/team/project.git',
        token: 'ghp_abc123',
        branchName: 'feat/PM-1-test',
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0][0]).toBe('https://api.github.com/repos/team/project');
      expect(mockFetch.mock.calls[2][0]).toBe('https://api.github.com/repos/team/project/git/refs');
    });

    it('uses self-hosted GitHub Enterprise URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: { sha: 'abc123' } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ref: 'refs/heads/feat/PM-1-test' }),
      });

      await provider.createBranch({
        repoUrl: 'https://github.mycompany.com/team/project.git',
        token: 'ghp_abc123',
        branchName: 'feat/PM-1-test',
        sourceBranch: 'develop',
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://github.mycompany.com/api/v3/repos/team/project/git/refs/heads/develop',
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: 'Reference already exists' }),
      });

      await expect(
        provider.createBranch({
          repoUrl: 'https://github.com/team/project.git',
          token: 'ghp_abc123',
          branchName: 'feat/PM-1-test',
          sourceBranch: 'main',
        }),
      ).rejects.toThrow('GitHub API error (422): Reference already exists');
    });
  });

  describe('createPr', () => {
    it('creates a pull request and returns url + number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            number: 15,
            html_url: 'https://github.com/team/project/pull/15',
          }),
      });

      const result = await provider.createPr({
        repoUrl: 'https://github.com/team/project.git',
        token: 'ghp_abc123',
        title: 'feat(PM-1): add feature',
        description: 'Description here',
        sourceBranch: 'feat/PM-1-test',
        targetBranch: 'develop',
      });

      expect(result).toEqual({
        prUrl: 'https://github.com/team/project/pull/15',
        prNumber: 15,
      });
    });
  });
});
