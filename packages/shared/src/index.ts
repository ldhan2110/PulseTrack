export const ProjectRole = {
  PM: 'pm',
  BA: 'ba',
  QC: 'qc',
  DEVELOPER: 'developer',
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
  BLOCKED: 'BLOCKED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const BugSeverity = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type BugSeverity = (typeof BugSeverity)[keyof typeof BugSeverity];

export const BugStatus = {
  OPEN: 'OPEN',
  IN_FIX: 'IN_FIX',
  FIXED: 'FIXED',
  VERIFIED: 'VERIFIED',
  CLOSED: 'CLOSED',
} as const;
export type BugStatus = (typeof BugStatus)[keyof typeof BugStatus];

export const SprintStatus = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

export const AiJobStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type AiJobStatus = (typeof AiJobStatus)[keyof typeof AiJobStatus];

export const AiJobType = {
  STORY_GENERATION: 'STORY_GENERATION',
  TASK_ASSIGNMENT: 'TASK_ASSIGNMENT',
  DAILY_REPORT: 'DAILY_REPORT',
  WEEKLY_REPORT: 'WEEKLY_REPORT',
} as const;
export type AiJobType = (typeof AiJobType)[keyof typeof AiJobType];

export const SyncStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export interface UserProfile {
  id: string;
  keycloakId: string;
  email: string;
  username: string;
}

export interface ProjectMemberProfile {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  preferred_username: string;
  realm_access?: { roles: string[] };
}

export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  parentId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bug {
  id: string;
  title: string;
  description: string | null;
  severity: BugSeverity;
  reproductionSteps: string | null;
  environment: string | null;
  status: BugStatus;
  projectId: string;
  reporterId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  createdAt: string;
}
