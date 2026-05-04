export interface AiFixJobData {
  fixId: string;
  bugId: string;
  projectId: string;
  userId: string;
  targetBranch: string;
  guidance: string | null;
  includeTests: boolean;
}

export interface AiFixAnalysis {
  rootCause: string | null;
  solution: string | null;
  filesChanged: string | null;
}
