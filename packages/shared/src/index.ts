export enum SystemRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum ProjectRole {
  PM = 'pm',
  BA = 'ba',
  DEVELOPER = 'developer',
  LEADERSHIP = 'leadership',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
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
  role: SystemRole;
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
