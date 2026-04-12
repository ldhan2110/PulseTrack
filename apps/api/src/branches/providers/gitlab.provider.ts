import type { GitProvider, CreateBranchParams, CreatePrParams, PrResult } from './git-provider.interface';

export class GitLabProvider implements GitProvider {
  private parseRepoUrl(repoUrl: string): { apiBase: string; projectPath: string } {
    const url = new URL(repoUrl);
    const pathname = url.pathname.replace(/\.git$/, '').replace(/^\//, '');
    const projectPath = encodeURIComponent(pathname);
    const apiBase = `${url.origin}/api/v4`;
    return { apiBase, projectPath };
  }

  private async apiRequest(url: string, token: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': token,
        ...options.headers,
      },
    });

    const body = await response.json();
    if (!response.ok) {
      const message = typeof body?.message === 'string' ? body.message : JSON.stringify(body.message ?? body);
      throw new Error(`GitLab API error (${response.status}): ${message}`);
    }
    return body;
  }

  async createBranch(params: CreateBranchParams): Promise<void> {
    const { apiBase, projectPath } = this.parseRepoUrl(params.repoUrl);

    let ref = params.sourceBranch;
    if (!ref) {
      const project = await this.apiRequest(
        `${apiBase}/projects/${projectPath}`,
        params.token,
      );
      ref = project.default_branch;
    }

    await this.apiRequest(
      `${apiBase}/projects/${projectPath}/repository/branches`,
      params.token,
      {
        method: 'POST',
        body: JSON.stringify({ branch: params.branchName, ref }),
      },
    );
  }

  async createPr(params: CreatePrParams): Promise<PrResult> {
    const { apiBase, projectPath } = this.parseRepoUrl(params.repoUrl);

    const mr = await this.apiRequest(
      `${apiBase}/projects/${projectPath}/merge_requests`,
      params.token,
      {
        method: 'POST',
        body: JSON.stringify({
          source_branch: params.sourceBranch,
          target_branch: params.targetBranch ?? 'main',
          title: params.title,
          description: params.description,
        }),
      },
    );

    return { prUrl: mr.web_url, prNumber: mr.iid };
  }
}
