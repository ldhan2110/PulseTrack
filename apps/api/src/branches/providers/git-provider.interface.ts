export interface CreateBranchParams {
  repoUrl: string;
  token: string;
  branchName: string;
  sourceBranch?: string; // defaults to repo default branch
}

export interface CreatePrParams {
  repoUrl: string;
  token: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch?: string; // defaults to repo default branch
}

export interface PrResult {
  prUrl: string;
  prNumber: number;
}

export interface GitProvider {
  createBranch(params: CreateBranchParams): Promise<void>;
  createPr(params: CreatePrParams): Promise<PrResult>;
}
