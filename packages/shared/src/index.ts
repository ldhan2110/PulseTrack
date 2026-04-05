export enum ProjectRole {
  PM = 'pm',
  BA = 'ba',
  QC = 'qc',
  DEVELOPER = 'developer',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export enum BugSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum BugStatus {
  OPEN = 'OPEN',
  IN_FIX = 'IN_FIX',
  FIXED = 'FIXED',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
}

export enum SprintStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum AiJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AiJobType {
  STORY_GENERATION = 'STORY_GENERATION',
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  DAILY_REPORT = 'DAILY_REPORT',
  WEEKLY_REPORT = 'WEEKLY_REPORT',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

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
