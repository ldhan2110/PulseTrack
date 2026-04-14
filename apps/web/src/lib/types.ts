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
  imageUrl: string | null;
  name: string | null;
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
  kind?: WorkflowKind;
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKER';

export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type WorkflowKind = 'TASK' | 'BUG';

export interface BugReproStep {
  id: string;
  bugId: string;
  position: number;
  content: string;
}

export interface BugAttachment {
  id: string;
  bugId: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  createdAt: string;
  uploader?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface CustomRole {
  id: string;
  projectId: string;
  name: string;
  permissions: import('./permissions').RolePermissions;
  isDefault: boolean;
  isSystem: boolean;
  _count?: { members: number };
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  keycloakId: string;
  email: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  avatarUrl: string | null;
  archived: boolean;
  emailNotificationsEnabled?: boolean;
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
  emailNotificationsEnabled?: boolean;
}

// ─── Member ───────────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  userId: string;
  projectId: string;
  roleId: string;
  joinedAt: string;
  user: User;
  customRole: CustomRole;
}

export interface AddMemberPayload {
  userId: string;
  roleId: string;
}

export interface AddMembersPayload {
  members: AddMemberPayload[];
}

export interface ChangeRolePayload {
  roleId: string;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface TimeLog {
  id: string;
  minutes: number;
  loggedAt: string;
  comment: string | null;
  taskId: string;
  userId: string;
  progress?: number | null;
  user?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
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
  children?: Task[];
  parent?: Pick<Task, 'id' | 'taskKey' | 'title'> | null;
  parentId?: string | null;
  estimatedMinutes?: number | null;
  timeLogs?: TimeLog[];
  acceptanceCriteria?: string | null;  // JSON string — parsed client-side into AcceptanceCriteria[]
  priority?: Priority | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  progress?: number;
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
  parentId?: string;
  estimatedMinutes?: number;
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
  estimatedMinutes?: number | null;
  progress?: number;
}

export interface CreateTimeLogPayload {
  minutes: number;
  comment?: string;
  loggedAt?: string;
  progress?: number;
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
  bugKey: string | null;
  title: string;
  description: string | null;
  preconditions: string | null;
  severity: BugSeverity;
  environment: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  workflowStatusId: string | null;
  workflowStatus?: WorkflowStatus | null;
  assigneeId: string | null;
  ownerId: string | null;
  reporterId: string;
  projectId: string;
  bugTasks?: { task: { id: string; taskKey: string | null; title: string } }[];
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  owner?: User | null;
  reporter?: User;
  reproSteps?: BugReproStep[];
  attachments?: BugAttachment[];
}

export interface CreateBugPayload {
  title: string;
  description?: string;
  preconditions?: string;
  severity: BugSeverity;
  environment?: string;
  expectedResult?: string;
  actualResult?: string;
  assigneeId?: string;
  ownerId?: string;
  reproSteps?: { position: number; content: string }[];
}

export interface UpdateBugPayload {
  title?: string;
  description?: string;
  preconditions?: string;
  severity?: BugSeverity;
  environment?: string;
  expectedResult?: string;
  actualResult?: string;
  assigneeId?: string | null;
  ownerId?: string | null;
  workflowStatusId?: string;
  reproSteps?: { position: number; content: string }[];
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

export interface MemberPerformanceRow {
  userId: string;
  name: string;
  imageUrl: string | null;
  tasks: {
    completed: number;
    inProgress: number;
    todo: number;
    total: number;
  };
  hoursLogged: number;
  avgHoursPerTask: number;
  bugCount: number;
  qualityRatio: number;
}

export interface DashboardData {
  taskCounts: TaskCounts;
  activeSprint: ActiveSprintData | null;
  burndown: BurndownPoint[];
  bugCounts: BugCounts;
  memberPerformance: MemberPerformanceRow[];
  teamAvgHoursPerTask: number;
}

// ─── Comment ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  content: string;
  taskId: string | null;
  bugId: string | null;
  authorId: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
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
  uploader: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
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
  actor: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

// ─── Bug History ─────────────────────────────────────────────────────────────

export interface BugHistoryEntry {
  id: string;
  bugId: string;
  actorId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

// ─── Repository Config ──────────────────────────────────────────────────────

export type CloneStatus = 'pending' | 'cloning' | 'cloned' | 'failed';

export interface RepositoryConfig {
  id: string;
  repoUrl: string;
  accessToken: string; // masked
  provider: 'github' | 'gitlab';
  cloneStatus: CloneStatus;
  cloneError: string | null;
  workspacePath: string | null;
}

export interface UpsertRepositoryConfigPayload {
  repoUrl: string;
  accessToken: string;
  provider?: 'github' | 'gitlab';
}

// ─── Task Branches ──────────────────────────────────────────────────────────

export type BranchType = 'feat' | 'fix' | 'chore' | 'hotfix' | 'refactor';

export interface TaskBranch {
  id: string;
  taskId: string;
  projectId: string;
  branchName: string;
  branchType: BranchType;
  sequence: number;
  prUrl: string | null;
  prNumber: number | null;
  prTitle: string | null;
  prStatus: 'open' | 'merged' | 'closed' | null;
  createdAt: string;
}

export interface CreateBranchPayload {
  branchType: BranchType;
  sourceBranch?: string;
}

export interface CreatePrPayload {
  branchId: string;
  targetBranch?: string;
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

// ─── Planner AI Config ───────────────────────────────────────────────────────

export interface PlannerAiConfig {
  id: string;
  provider: string;
  model: string;
  apiKey: string; // masked
}

export interface UpsertPlannerAiConfigPayload {
  provider: string;
  model: string;
  apiKey?: string;
}

// ─── AI Task Generation ─────────────────────────────────────────────────────

export interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storyPoints: number;
  subTasks?: GeneratedTask[];
}

export interface GenerateTasksPayload {
  prompt: string;
  scanCodebase?: boolean;
  breakIntoSubTasks?: boolean;
  documents?: File[];
}

export type AiGenerationStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface AiGenerationJobResult {
  status: AiGenerationStatus;
  step?: AiGenerationStep;
  tasks?: GeneratedTask[];
  error?: string;
  streamText?: string;
  displayLines?: string[];
  rawText?: string;
}

export type AiGenerationStep = 'pulling' | 'building-graph' | 'scanning' | 'generating' | 'parsing';

export interface AiGenerationProgressEvent {
  jobId: string;
  step: AiGenerationStep;
}

export interface AiGenerationCompletedEvent {
  jobId: string;
  taskCount: number;
}

export interface AiGenerationFailedEvent {
  jobId: string;
  error: string;
}

export interface AiGenerationStreamEvent {
  jobId: string;
  text: string;
}

// ─── AI Test Case Generation ────────────────────────────────────────────────

export interface GeneratedTestCaseStep {
  position: number;
  action: string;
  expectedResult: string;
}

export interface GeneratedTestCase {
  title: string;
  preconditions: string | null;
  expectedResult: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKER';
  estimatedMinutes: number | null;
  tags: string[];
  suggestedModule: string;
  sourceTaskTitle: string;
  steps?: GeneratedTestCaseStep[];
}

export interface AiTestCaseGenerationJobResult {
  status: AiGenerationStatus;
  step?: AiGenerationStep;
  testCases?: GeneratedTestCase[];
  error?: string;
  streamText?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'STATUS_CHANGE' | 'ASSIGNEE_CHANGE' | 'COMMENT_ADDED' | 'COMMENT_EDITED'
  | 'COMMENT_DELETED' | 'ATTACHMENT_CHANGE' | 'CRITERIA_CHANGE' | 'SUBTASK_CHANGE'
  | 'DESCRIPTION_EDIT' | 'SPRINT_CHANGE' | 'PRIORITY_CHANGE' | 'TICKET_DELETED' | 'MENTION';

export type EntityType = 'TASK' | 'BUG';

export interface Notification {
  id: string;
  recipientId: string;
  projectId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  actorId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

export interface NotificationPage {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

export interface TicketWatcher {
  id: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  createdAt: string;
  user: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

// ─── Test Case Management ────────────────────────────────────────────────────

export type TestCaseStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
export type TestResultStatus = 'NOT_RUN' | 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP';
export type TestExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TestModule {
  id: string;
  name: string;
  position: number;
  projectId: string;
  parentId: string | null;
  _count?: { testCases: number };
}

export interface TestCaseStep {
  id: string;
  testCaseId: string;
  position: number;
  action: string;
  expectedResult: string;
}

export interface TestCaseLink {
  id: string;
  testCaseId: string;
  entityType: EntityType;
  entityId: string;
}

export interface TestCase {
  id: string;
  testCaseKey: string | null;
  title: string;
  preconditions: string | null;
  expectedResult: string | null;
  priority: Priority | null;
  status: TestCaseStatus;
  tags: string[];
  estimatedMinutes: number | null;
  moduleId: string;
  projectId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  steps?: TestCaseStep[];
  links?: TestCaseLink[];
  module?: { id: string; name: string };
  creator?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
  _count?: { steps: number };
}

export interface CreateTestCasePayload {
  title: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  tags?: string[];
  estimatedMinutes?: number;
  moduleId: string;
  steps?: { position: number; action: string; expectedResult: string }[];
  links?: { entityType: EntityType; entityId: string }[];
}

export interface UpdateTestCasePayload {
  title?: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  status?: TestCaseStatus;
  tags?: string[];
  estimatedMinutes?: number;
  moduleId?: string;
  steps?: { position: number; action: string; expectedResult: string }[];
  links?: { entityType: EntityType; entityId: string }[];
}

export interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
  members?: {
    id: string;
    position: number;
    testCase: Pick<TestCase, 'id' | 'testCaseKey' | 'title' | 'priority' | 'status'> & {
      _count?: { steps: number };
    };
  }[];
}

export interface CreateTestSuitePayload {
  name: string;
  description?: string;
}

export interface UpdateTestSuitePayload {
  name?: string;
  description?: string;
}

export interface TestExecutionStats {
  total: number;
  PASS: number;
  FAIL: number;
  BLOCKED: number;
  SKIP: number;
  NOT_RUN: number;
  IN_PROGRESS: number;
  completed: number;
  completionPercent: number;
}

export interface TestExecutionAttachment {
  id: string;
  executionCaseId: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  createdAt: string;
  uploader?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

export interface TestExecutionCase {
  id: string;
  executionId: string;
  testCaseId: string;
  result: TestResultStatus;
  notes: string | null;
  executedById: string | null;
  executedAt: string | null;
  testCase: Pick<TestCase, 'id' | 'testCaseKey' | 'title' | 'priority' | 'expectedResult' | 'preconditions'> & {
    steps: TestCaseStep[];
    links: TestCaseLink[];
  };
  executedBy?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'> | null;
  attachments?: TestExecutionAttachment[];
}

export interface TestExecution {
  id: string;
  executionKey: string | null;
  name: string;
  status: TestExecutionStatus;
  assigneeId: string;
  projectId: string;
  sprintId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
  sprint?: { id: string; name: string } | null;
  cases?: TestExecutionCase[];
  stats?: TestExecutionStats;
}

export interface CreateTestExecutionPayload {
  name: string;
  assigneeId: string;
  sprintId?: string;
  suiteId?: string;
  testCaseIds?: string[];
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export interface BulkImportTestCaseItem {
  title: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  tags?: string[];
  estimatedMinutes?: number;
  moduleName?: string;
  steps?: { position: number; action: string; expectedResult: string }[];
}

export interface BulkImportTestCasesPayload {
  items: BulkImportTestCaseItem[];
}

export interface BulkImportResult {
  created: number;
  modulesCreated: string[];
}

export interface BulkImportBugItem {
  title: string;
  preconditions?: string;
  description?: string;
  severity: BugSeverity;
  environment?: string;
  expectedResult?: string;
  actualResult?: string;
  statusName?: string;
  reproSteps?: { position: number; content: string }[];
}

export interface BulkImportBugsPayload {
  items: BulkImportBugItem[];
}

export interface BulkImportBugsResult {
  created: number;
}

// ─── Wiki ──────────────────────────────────────────────────────────────
export interface WikiConfig {
  id: string;
  projectId: string;
  autoUpdate: 'manual' | 'on-pull' | 'scheduled';
  sections: string[];
  lastGeneratedAt: string | null;
}

export interface UpsertWikiConfigPayload {
  autoUpdate?: string;
  sections?: string[];
}

export interface WikiTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WikiTreeNode[];
}

export interface WikiPageContent {
  path: string;
  content: string;
}

export interface WikiSearchResult {
  path: string;
  title: string;
  snippet: string;
}

export interface WikiAnnotation {
  id: string;
  projectId: string;
  pagePath: string;
  sectionRef: string | null;
  content: string;
  authorId: string;
  author: { id: string; username: string; email: string; name: string | null; imageUrl: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface WikiGenerationStatus {
  status: string;
  step?: string;
  streamText?: string;
  result?: { pagesGenerated: number; sections: Record<string, number>; errors: string[] };
  error?: string;
}

export interface ActiveWikiJob {
  active: boolean;
  jobId?: string;
  status?: string;
  step?: string;
  sections?: string[];
}

// ─── Report Config ──────────────────────────────────────────────────────
export interface ReportConfig {
  id: string;
  projectId: string;
  emailEnabled: boolean;
  googleChatEnabled: boolean;
  googleChatWebhookUrl: string | null;
  recipientMode: string;
  recipientRoles: string[];
  recipientMembers: string[];
  frequency: string;
  scheduleDays: number[];
  scheduleTime: string;
  timezone: string;
  isActive: boolean;
}

export interface UpsertReportConfigPayload {
  emailEnabled?: boolean;
  googleChatEnabled?: boolean;
  googleChatWebhookUrl?: string;
  recipientMode?: string;
  recipientRoles?: string[];
  recipientMembers?: string[];
  frequency?: string;
  scheduleDays?: number[];
  scheduleTime?: string;
  timezone?: string;
  isActive?: boolean;
}

// ─── Planner ─────────────────────────────────────────────────

export interface PlannerFeature {
  id: string;
  scopeId: string;
  title: string;
  description: string | null;
  position: number;
  aiGenerated: boolean;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerScope {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  position: number;
  aiGenerated: boolean;
  features: PlannerFeature[];
  createdAt: string;
  updatedAt: string;
}

export interface PlannerAttachment {
  id: string;
  messageId: string;
  fileName: string;
  storedName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface PlannerMessage {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  attachments: PlannerAttachment[];
  createdAt: string;
}

export interface PlannerSession {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  scopes: PlannerScope[];
  createdAt: string;
  updatedAt: string;
}

export interface PlannerSessionListItem {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  _count: { scopes: number; messages: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlannerSessionPayload {
  name: string;
  description?: string;
}

export interface UpdatePlannerSessionPayload {
  name?: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface CreateScopePayload {
  title: string;
  description?: string;
}

export interface UpdateScopePayload {
  title?: string;
  description?: string;
}

export interface CreateFeaturePayload {
  title: string;
  description?: string;
}

export interface UpdateFeaturePayload {
  title?: string;
  description?: string;
}

export interface SendMessageResult {
  messageId: string;
  streamToken: string;
}

// ─── WBS Types ─────────────────────────────────────────────

export interface WbsSubtask {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  position: number;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  backlogItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WbsTask {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  position: number;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  backlogItemId: string | null;
  subtasks: WbsSubtask[];
  createdAt: string;
  updatedAt: string;
}

export interface WbsPhase {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  position: number;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  tasks: WbsTask[];
  createdAt: string;
  updatedAt: string;
}

export interface WbsDependency {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: 'TASK' | 'SUBTASK';
  targetId: string;
  targetType: 'TASK' | 'SUBTASK';
  type: 'FINISH_TO_START';
  createdAt: string;
}

export interface CreateWbsPhasePayload {
  title: string;
  description?: string;
}

export interface UpdateWbsPhasePayload {
  title?: string;
  description?: string;
}

export interface CreateWbsTaskPayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
}

export interface UpdateWbsTaskPayload {
  title?: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
}

export interface CreateWbsSubtaskPayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
}

export interface UpdateWbsSubtaskPayload {
  title?: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
}

export interface CreateWbsDependencyPayload {
  sourceId: string;
  sourceType: 'TASK' | 'SUBTASK';
  targetId: string;
  targetType: 'TASK' | 'SUBTASK';
}

export interface LinkBacklogPayload {
  backlogItemId: string;
}
