// ─── Enums ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';

export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type BugStatus = 'OPEN' | 'IN_FIX' | 'FIXED' | 'VERIFIED' | 'CLOSED';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export type ProjectRole = 'PM' | 'BA' | 'QC' | 'DEVELOPER';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  keycloakId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  name: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  members?: Member[];
  _count?: {
    tasks: number;
  };
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
}

// ─── Member ───────────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  joinedAt: string;
  user: User;
}

export interface AddMemberPayload {
  userId: string;
  role: ProjectRole;
}

export interface ChangeRolePayload {
  role: ProjectRole;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  storyPoints: number | null;
  assigneeId: string | null;
  sprintId: string | null;
  projectId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  createdBy?: User;
  sprint?: Sprint | null;
  subTasks?: SubTask[];
  acceptanceCriteria?: AcceptanceCriteria[];
}

export interface AcceptanceCriteria {
  id: string;
  text: string;
  completed: boolean;
  taskId: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  storyPoints?: number;
  assigneeId?: string;
  sprintId?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  storyPoints?: number;
  assigneeId?: string | null;
  sprintId?: string | null;
}

export interface CreateSubTaskPayload {
  title: string;
  assigneeId?: string;
}

export interface UpdateSubTaskPayload {
  title?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
}

// ─── Sprint ───────────────────────────────────────────────────────────────────

export interface Sprint {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  _count?: {
    tasks: number;
  };
}

export interface SprintStats {
  totalPoints: number;
  completedPoints: number;
  totalTasks: number;
  completedTasks: number;
}

export interface CreateSprintPayload {
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateSprintPayload {
  name?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Bug ──────────────────────────────────────────────────────────────────────

export interface Bug {
  id: string;
  title: string;
  description: string | null;
  severity: BugSeverity;
  status: BugStatus;
  stepsToReproduce: string | null;
  environment: string | null;
  assigneeId: string | null;
  reporterId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  reporter?: User;
}

export interface CreateBugPayload {
  title: string;
  description?: string;
  severity: BugSeverity;
  stepsToReproduce?: string;
  environment?: string;
  assigneeId?: string;
}

export interface UpdateBugPayload {
  title?: string;
  description?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  stepsToReproduce?: string;
  environment?: string;
  assigneeId?: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStatCard {
  total: number;
  inProgress: number;
  done: number;
  blocked: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  userId: string;
  createdAt: string;
  user?: User;
}

export interface DashboardData {
  taskStats: DashboardStatCard;
  activeSprint: Sprint | null;
  sprintStats: SprintStats | null;
  burndown: BurndownPoint[];
  recentActivity: ActivityItem[];
}
