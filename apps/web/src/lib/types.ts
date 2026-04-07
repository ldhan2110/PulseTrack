// ─── Enums ────────────────────────────────────────────────────────────────────

export type AutoDateField = 'actualStartDate' | 'actualEndDate' | 'plannedStartDate' | 'plannedEndDate';
export type AutoDateAction = 'set' | 'clear';

export interface WorkflowStatus {
  id: string;
  projectId: string;
  name: string;
  key: string;
  color: string;
  position: number;
  isDefault: boolean;
  isClosed: boolean;
  autoDateField: AutoDateField | null;
  autoDateAction: AutoDateAction | null;
}

export interface WorkflowTransition {
  id: string;
  fromStatusKey: string;
  toStatusKey: string;
  fromStatusId: string;
  toStatusId: string;
}

export interface WorkflowAllowedAssignee {
  memberId: string;
  userId: string;
  username: string;
  email: string;
}

export interface WorkflowData {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  assigneeRules: Record<string, WorkflowAllowedAssignee[]>;
  layout: Record<string, unknown> | null;
}

export interface SaveWorkflowPayload {
  statuses: {
    id?: string;
    name: string;
    key: string;
    color: string;
    position: number;
    isDefault: boolean;
    isClosed: boolean;
    autoDateField?: AutoDateField | null;
    autoDateAction?: AutoDateAction | null;
  }[];
  transitions: {
    fromStatusKey: string;
    toStatusKey: string;
  }[];
  assigneeRules: {
    statusKey: string;
    memberIds: string[];
  }[];
  layout?: Record<string, unknown>;
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKER';

export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type BugStatus = 'OPEN' | 'IN_FIX' | 'FIXED' | 'VERIFIED' | 'CLOSED';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export type ProjectRole = 'pm' | 'ba' | 'qc' | 'developer';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  keycloakId: string;
  email: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  username: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  avatarUrl: string | null;
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
  prefix: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
}

export interface UpdateSettingsPayload {
  name?: string;
  description?: string;
  prefix?: string;
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

export interface AddMembersPayload {
  members: AddMemberPayload[];
}

export interface ChangeRolePayload {
  role: ProjectRole;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface SubTask {
  id: string;
  title: string;
  workflowStatusId: string | null;
  workflowStatus?: WorkflowStatus | null;
  assigneeId: string | null;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
}

export interface Task {
  id: string;
  taskKey: string | null;
  title: string;
  description: string | null;
  workflowStatusId: string | null;
  workflowStatus?: WorkflowStatus | null;
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
  project?: Pick<Project, 'id' | 'name' | 'prefix'>;
  subTasks?: SubTask[];
  acceptanceCriteria?: string | null;  // JSON string — parsed client-side into AcceptanceCriteria[]
  priority?: Priority | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
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
  storyPoints?: number;
  assigneeId?: string;
  sprintId?: string;
  acceptanceCriteria?: string;
  priority?: Priority;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  workflowStatusId?: string;
  storyPoints?: number;
  assigneeId?: string | null;
  sprintId?: string | null;
  acceptanceCriteria?: string;  // JSON string of AcceptanceCriteria[]
  priority?: Priority | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
}

export interface CreateSubTaskPayload {
  title: string;
  assigneeId?: string;
}

export interface UpdateSubTaskPayload {
  title?: string;
  workflowStatusId?: string;
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

export interface StatusCount {
  statusId: string;
  name: string;
  key: string;
  color: string;
  count: number;
  isClosed: boolean;
}

export interface TaskCounts {
  total: number;
  byStatus: StatusCount[];
  orphaned: number;
}

export interface BurndownPoint {
  date: string;
  ideal: number;
  actual: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  actor: string;
  timestamp: string;
}

export interface ActiveSprintData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
}

export interface BugCounts {
  total: number;
  open: number;
  critical: number;
}

export interface DashboardData {
  taskCounts: TaskCounts;
  activeSprint: ActiveSprintData | null;
  recentActivity: ActivityItem[];
  burndown: BurndownPoint[];
  bugCounts: BugCounts;
}

// ─── Comment ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'username' | 'email'>;
  replies?: Comment[];
}

export interface CreateCommentPayload {
  content: string;
}

// ─── Attachment ──────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  taskId: string;
  uploaderId: string;
  isInline: boolean;
  createdAt: string;
  uploader: Pick<User, 'id' | 'username' | 'email'>;
}

// ─── Task History ────────────────────────────────────────────────────────────

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  actorId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'username' | 'email'>;
}

// ─── Repository Config ──────────────────────────────────────────────────────

export type CloneStatus = 'pending' | 'cloning' | 'cloned' | 'failed';

export interface RepositoryConfig {
  id: string;
  repoUrl: string;
  accessToken: string; // masked
  cloneStatus: CloneStatus;
  cloneError: string | null;
  workspacePath: string | null;
}

export interface UpsertRepositoryConfigPayload {
  repoUrl: string;
  accessToken: string;
}

// ─── AI Config ───────────────────────────────────────────────────────────────

export type AiProvider = 'claude' | 'gemini' | 'codex';

export interface AiConfig {
  id: string;
  provider: AiProvider;
  model: string;
  apiKey: string; // masked
  projectContext: string | null;
}

export interface UpsertAiConfigPayload {
  provider: AiProvider;
  model: string;
  apiKey: string;
  projectContext?: string;
}

export interface UpdateProjectContextPayload {
  projectContext: string;
}
