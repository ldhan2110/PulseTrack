import type { GitProvider, ListBranchesParams, CreateBranchParams, CreatePrParams, PrResult } from './git-provider.interface';

export class GitHubProvider implements GitProvider {
  private parseRepoUrl(repoUrl: string): { apiBase: string; ownerRepo: string } {
    const url = new URL(repoUrl);
    const ownerRepo = url.pathname.replace(/\.git$/, '').replace(/^\//, '');
    const isGitHubCom = url.hostname === 'github.com';
    const apiBase = isGitHubCom ? 'https://api.github.com' : `${url.origin}/api/v3`;
    return { apiBase, ownerRepo };
  }

  private async apiRequest(url: string, token: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        ...options.headers,
      },
    });

    const body = await response.json();
    if (!response.ok) {
      const message = body?.message ?? JSON.stringify(body);
      throw new Error(`GitHub API error (${response.status}): ${message}`);
    }
    return body;
  }

  async listBranches(params: ListBranchesParams): Promise<string[]> {
    const { apiBase, ownerRepo } = this.parseRepoUrl(params.repoUrl);
    const branches: string[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const data = await this.apiRequest(
        `${apiBase}/repos/${ownerRepo}/branches?per_page=${perPage}&page=${page}`,
        params.token,
      );
      for (const b of data) {
        branches.push(b.name);
      }
      if (data.length < perPage) break;
      page++;
    }

    return branches.sort();
  }

  async createBranch(params: CreateBranchParams): Promise<void> {
    const { apiBase, ownerRepo } = this.parseRepoUrl(params.repoUrl);

    let ref = params.sourceBranch;
    if (!ref) {
      const repo = await this.apiRequest(
        `${apiBase}/repos/${ownerRepo}`,
        params.token,
      );
      ref = repo.default_branch;
    }

    const refData = await this.apiRequest(
      `${apiBase}/repos/${ownerRepo}/git/refs/heads/${ref}`,
      params.token,
    );

    await this.apiRequest(
      `${apiBase}/repos/${ownerRepo}/git/refs`,
      params.token,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${params.branchName}`,
          sha: refData.object.sha,
        }),
      },
    );
  }

  async createPr(params: CreatePrParams): Promise<PrResult> {
    const { apiBase, ownerRepo } = this.parseRepoUrl(params.repoUrl);

    const pr = await this.apiRequest(
      `${apiBase}/repos/${ownerRepo}/pulls`,
      params.token,
      {
        method: 'POST',
        body: JSON.stringify({
          head: params.sourceBranch,
          base: params.targetBranch ?? 'main',
          title: params.title,
          body: params.description,
        }),
      },
    );

    return { prUrl: pr.html_url, prNumber: pr.number };
  }
}
