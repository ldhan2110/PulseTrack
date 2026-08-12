import type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  Member,
  AddMemberPayload,
  AddMembersPayload,
  ChangeRolePayload,
  CustomRole,
  UserSearchResult,
  Task,
  CreateTaskPayload,
  UpdateTaskPayload,
  TimeLog,
  CreateTimeLogPayload,
  Sprint,
  CreateSprintPayload,
  UpdateSprintPayload,
  SprintStats,
  Bug,
  AiBugFix,
  CreateBugPayload,
  UpdateBugPayload,
  DashboardData,
  Comment,
  CreateCommentPayload,
  ToggleLikeResponse,
  Attachment,
  TaskHistoryEntry,
  BugHistoryEntry,
  UpdateSettingsPayload,
  WorkflowData,
  WorkflowStatus,
  SaveWorkflowPayload,
  WorkflowAllowedAssignee,
  RepositoryConfig,
  UpsertRepositoryConfigPayload,
  AiConfig,
  UpsertAiConfigPayload,
  UpdateProjectContextPayload,
  AiGenerationJobResult,
  BugAttachment,
  WorkflowKind,
  NotificationPage,
  TicketWatcher,
  TestModule,
  TestCase,
  CreateTestCasePayload,
  UpdateTestCasePayload,
  TestSuite,
  CreateTestSuitePayload,
  UpdateTestSuitePayload,
  TestExecution,
  CreateTestExecutionPayload,
  TestExecutionCase,
  TestExecutionAttachment,
  BulkImportTestCasesPayload,
  BulkImportResult,
  BulkImportBugsPayload,
  BulkImportBugsResult,
  WikiConfig,
  UpsertWikiConfigPayload,
  WikiTreeNode,
  WikiPageContent,
  WikiSearchResult,
  WikiAnnotation,
  WikiGenerationStatus,
  ActiveWikiJob,
  AiTestCaseGenerationJobResult,
  ReportConfig,
  UpsertReportConfigPayload,
  TaskBranch,
  CreateBranchPayload,
  CreatePrPayload,
  PlannerSessionListItem,
  PlannerSession,
  CreatePlannerSessionPayload,
  UpdatePlannerSessionPayload,
  PlannerMessage,
  SendMessageResult,
  PlannerScope,
  CreateScopePayload,
  UpdateScopePayload,
  PlannerFeature,
  CreateFeaturePayload,
  UpdateFeaturePayload,
  WbsPhase,
  WbsTask,
  WbsSubtask,
  WbsDependency,
  CreateWbsPhasePayload,
  UpdateWbsPhasePayload,
  CreateWbsTaskPayload,
  UpdateWbsTaskPayload,
  CreateWbsSubtaskPayload,
  UpdateWbsSubtaskPayload,
  CreateWbsDependencyPayload,
  LinkBacklogPayload,
  BulkCreateWbsPayload,
  AiWbsGenerationJobResult,
  WbsChatResponse,
  SavedFilter,
  CreateSavedFilterPayload,
  UpdateSavedFilterPayload,
  TestCaseAutomation,
  AutomationRun,
  ProjectVariable,
} from './types';
import type { RolePermissions } from './permissions';
import keycloak from '../auth/keycloak';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = keycloak.token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `API error: ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function downloadFile(path: string, params?: Record<string, string>): Promise<void> {
  const token = keycloak.token;
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
  }
  const qs = sp.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match?.[1] ?? 'export.xlsx';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export const api = {
  // ─── Projects ──────────────────────────────────────────────────────────────
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: CreateProjectPayload) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (id: string, data: UpdateProjectPayload) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveProject: (id: string) =>
    request<void>(`/projects/${id}/archive`, { method: 'POST' }),
  unarchiveProject: (id: string) =>
    request<void>(`/projects/${id}/unarchive`, { method: 'POST' }),
  getProjectByPrefix: (prefix: string) => request<Project>(`/projects/by-prefix/${prefix}`),
  updateProjectSettings: (id: string, data: UpdateSettingsPayload) =>
    request<Project>(`/projects/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadProjectAvatar: async (id: string, file: File): Promise<Project> => {
    const token = keycloak.token;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/projects/${id}/avatar`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<Project>;
  },
  removeProjectAvatar: (id: string) =>
    request<Project>(`/projects/${id}/avatar`, { method: 'DELETE' }),

  // ─── Members ───────────────────────────────────────────────────────────────
  getMembers: (projectId: string) =>
    request<Member[]>(`/projects/${projectId}/members`),
  addMember: (projectId: string, data: AddMemberPayload) =>
    request<Member>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  addMembers: (projectId: string, data: AddMembersPayload) =>
    request<Member[]>(`/projects/${projectId}/members/batch`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  searchUsers: (projectId: string, query: string) =>
    request<UserSearchResult[]>(`/projects/${projectId}/members/search?q=${encodeURIComponent(query)}`),
  changeMemberRole: (projectId: string, memberId: string, data: ChangeRolePayload) =>
    request<void>(`/projects/${projectId}/members/${memberId}/role`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeMember: (projectId: string, memberId: string) =>
    request<void>(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
  getMemberActiveWork: (projectId: string, memberId: string) =>
    request<{ tasks: number; subTasks: number; bugs: number }>(`/projects/${projectId}/members/${memberId}/active-work`),

  // ─── Roles ──────────────────────────────────────────────────────────────────
  getRoles: (projectId: string) =>
    request<CustomRole[]>(`/projects/${projectId}/roles`),
  createRole: (projectId: string, data: { name: string; permissions: RolePermissions }) =>
    request<CustomRole>(`/projects/${projectId}/roles`, { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (projectId: string, roleId: string, data: Partial<{ name: string; permissions: RolePermissions; isDefault: boolean }>) =>
    request<CustomRole>(`/projects/${projectId}/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (projectId: string, roleId: string) =>
    request<{ deleted: boolean }>(`/projects/${projectId}/roles/${roleId}`, { method: 'DELETE' }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  getTasks: (projectId: string) =>
    request<Task[]>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: CreateTaskPayload) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getTask: (projectId: string, taskId: string) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`),
  getTaskByKey: (projectId: string, taskKey: string) =>
    request<Task>(`/projects/${projectId}/tasks/by-key/${taskKey}`),
  updateTask: (projectId: string, taskId: string, data: UpdateTaskPayload) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (projectId: string, taskId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  getMyTasks: () => request<Task[]>('/tasks/my-tasks'),
  exportTasks: (projectId: string, params?: Record<string, string>) =>
    downloadFile(`/projects/${projectId}/tasks/export`, params),

  // ─── Time Logs ─────────────────────────────────────────────────────────────
  getTimeLogs: (projectId: string, taskId: string) =>
    request<TimeLog[]>(`/projects/${projectId}/tasks/${taskId}/time-logs`),

  createTimeLog: (projectId: string, taskId: string, data: CreateTimeLogPayload) =>
    request<TimeLog>(`/projects/${projectId}/tasks/${taskId}/time-logs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteTimeLog: (projectId: string, taskId: string, timeLogId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/time-logs/${timeLogId}`, {
      method: 'DELETE',
    }),

  // ─── Sprints ───────────────────────────────────────────────────────────────
  getSprints: (projectId: string) =>
    request<Sprint[]>(`/projects/${projectId}/sprints`),
  createSprint: (projectId: string, data: CreateSprintPayload) =>
    request<Sprint>(`/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(data) }),
  getSprint: (projectId: string, sprintId: string) =>
    request<Sprint>(`/projects/${projectId}/sprints/${sprintId}`),
  updateSprint: (projectId: string, sprintId: string, data: UpdateSprintPayload) =>
    request<Sprint>(`/projects/${projectId}/sprints/${sprintId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  activateSprint: (projectId: string, sprintId: string) =>
    request<Sprint>(`/projects/${projectId}/sprints/${sprintId}/activate`, { method: 'POST' }),
  closeSprint: (projectId: string, sprintId: string) =>
    request<{ sprint: Sprint; movedToBacklog: number }>(`/projects/${projectId}/sprints/${sprintId}/close`, { method: 'POST' }),
  getSprintStats: (projectId: string, sprintId: string) =>
    request<SprintStats>(`/projects/${projectId}/sprints/${sprintId}/stats`),

  // ─── Bugs ──────────────────────────────────────────────────────────────────
  getBugs: (projectId: string) =>
    request<Bug[]>(`/projects/${projectId}/bugs`),
  createBug: (projectId: string, data: CreateBugPayload) =>
    request<Bug>(`/projects/${projectId}/bugs`, { method: 'POST', body: JSON.stringify(data) }),
  getBug: (projectId: string, bugId: string) =>
    request<Bug>(`/projects/${projectId}/bugs/${bugId}`),
  getBugByKey: (projectId: string, bugKey: string) =>
    request<Bug>(`/projects/${projectId}/bugs/by-key/${bugKey}`),
  updateBug: (projectId: string, bugId: string, data: UpdateBugPayload) =>
    request<Bug>(`/projects/${projectId}/bugs/${bugId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBug: (projectId: string, bugId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}`, { method: 'DELETE' }),
  bulkImportBugs: (projectId: string, data: BulkImportBugsPayload) =>
    request<BulkImportBugsResult>(`/projects/${projectId}/bugs/bulk-import`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  exportBugs: (projectId: string, params?: Record<string, string>) =>
    downloadFile(`/projects/${projectId}/bugs/export`, params),
  linkBugTasks: (projectId: string, bugId: string, taskIds: string[]) =>
    request<Bug>(`/projects/${projectId}/bugs/${bugId}/tasks`, { method: 'POST', body: JSON.stringify({ taskIds }) }),
  unlinkBugTask: (projectId: string, bugId: string, taskId: string) =>
    request<Bug>(`/projects/${projectId}/bugs/${bugId}/tasks/${taskId}`, { method: 'DELETE' }),
  createFixTask: (projectId: string, bugId: string, data: { parentId?: string; assigneeId?: string }) =>
    request<Task>(`/projects/${projectId}/bugs/${bugId}/create-fix-task`, { method: 'POST', body: JSON.stringify(data) }),
  // ─── AI Bug Fix ──────────────────────────────────────────────────────────
  startAiBugFix: (projectId: string, bugId: string, data: { targetBranch: string; guidance?: string; includeTests?: boolean }) =>
    request<{ fixId: string; jobId: string }>(`/projects/${projectId}/bugs/${bugId}/ai-fix`, { method: 'POST', body: JSON.stringify(data) }),
  getAiBugFixes: (projectId: string, bugId: string) =>
    request<AiBugFix[]>(`/projects/${projectId}/bugs/${bugId}/ai-fixes`),
  getAiBugFix: (projectId: string, bugId: string, fixId: string) =>
    request<AiBugFix>(`/projects/${projectId}/bugs/${bugId}/ai-fixes/${fixId}`),
  cancelAiBugFix: (projectId: string, bugId: string, fixId: string) =>
    request<{ cancelled: boolean; reason?: string }>(`/projects/${projectId}/bugs/${bugId}/ai-fixes/${fixId}/cancel`, { method: 'DELETE' }),
  deleteAiBugFix: (projectId: string, bugId: string, fixId: string) =>
    request<{ deleted: boolean }>(`/projects/${projectId}/bugs/${bugId}/ai-fixes/${fixId}`, { method: 'DELETE' }),
  getTaskBugs: (projectId: string, taskId: string) =>
    request<Bug[]>(`/projects/${projectId}/tasks/${taskId}/bugs`),

  // ─── Bug Attachments ──────────────────────────────────────────────────────
  getBugAttachments: (projectId: string, bugId: string) =>
    request<BugAttachment[]>(`/projects/${projectId}/bugs/${bugId}/attachments`),
  uploadBugAttachment: async (projectId: string, bugId: string, file: File, inline = false): Promise<BugAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const token = keycloak.token;
    const url = `${API_BASE}/projects/${projectId}/bugs/${bugId}/attachments${inline ? '?inline=true' : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<BugAttachment>;
  },
  getBugAttachmentDownloadUrl: (projectId: string, bugId: string, attachmentId: string) =>
    `${API_BASE}/projects/${projectId}/bugs/${bugId}/attachments/${attachmentId}/download`,
  getBugAttachmentInlineUrl: (projectId: string, bugId: string, attachmentId: string) =>
    `${API_BASE}/projects/${projectId}/bugs/${bugId}/attachments/${attachmentId}/download?inline=true`,
  downloadBugAttachment: async (projectId: string, bugId: string, attachmentId: string): Promise<Blob> => {
    const token = keycloak.token;
    const res = await fetch(
      `${API_BASE}/projects/${projectId}/bugs/${bugId}/attachments/${attachmentId}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.blob();
  },
  deleteBugAttachment: (projectId: string, bugId: string, attachmentId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/attachments/${attachmentId}`, { method: 'DELETE' }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getDashboard: (projectId: string, params = '') =>
    request<DashboardData>(`/projects/${projectId}/dashboard${params}`),

  // ─── Workflow ─────────────────────────────────────────────────────────────
  getWorkflow: (projectId: string, kind: WorkflowKind = 'TASK') =>
    request<WorkflowData>(`/projects/${projectId}/workflow?kind=${kind}`),
  saveWorkflow: (projectId: string, data: SaveWorkflowPayload) =>
    request<{ statuses: WorkflowStatus[] }>(`/projects/${projectId}/workflow`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getAllowedAssignees: (projectId: string, statusId: string) =>
    request<WorkflowAllowedAssignee[]>(`/projects/${projectId}/workflow/statuses/${statusId}/allowed-assignees`),

  // ─── Saved Filters ────────────────────────────────────────────────────────
  getSavedFilters: (projectId: string, entityType?: string) =>
    request<SavedFilter[]>(`/projects/${projectId}/saved-filters${entityType ? `?entityType=${entityType}` : ''}`),
  createSavedFilter: (projectId: string, data: CreateSavedFilterPayload) =>
    request<SavedFilter>(`/projects/${projectId}/saved-filters`, { method: 'POST', body: JSON.stringify(data) }),
  updateSavedFilter: (projectId: string, id: string, data: UpdateSavedFilterPayload) =>
    request<SavedFilter>(`/projects/${projectId}/saved-filters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSavedFilter: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/saved-filters/${id}`, { method: 'DELETE' }),

  // ─── Repository Config ────────────────────────────────────────────────────
  getRepositoryConfig: (projectId: string) =>
    request<RepositoryConfig | null>(`/projects/${projectId}/settings/repository`),
  upsertRepositoryConfig: (projectId: string, data: UpsertRepositoryConfigPayload) =>
    request<RepositoryConfig>(`/projects/${projectId}/settings/repository`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteRepositoryConfig: (projectId: string) =>
    request<void>(`/projects/${projectId}/settings/repository`, { method: 'DELETE' }),

  // ─── AI Config ────────────────────────────────────────────────────────────
  getAiConfig: (projectId: string) =>
    request<AiConfig | null>(`/projects/${projectId}/settings/ai`),
  upsertAiConfig: (projectId: string, data: UpsertAiConfigPayload) =>
    request<AiConfig>(`/projects/${projectId}/settings/ai`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateProjectContext: (projectId: string, data: UpdateProjectContextPayload) =>
    request<AiConfig>(`/projects/${projectId}/settings/ai/context`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  generateProjectContext: (projectId: string) =>
    request<{ projectContext: string }>(`/projects/${projectId}/settings/ai/context/generate`, {
      method: 'POST',
    }),

  // ─── Report Config ──────────────────────────────────────────────────────────
  getReportConfig: (projectId: string) =>
    request<ReportConfig | null>(`/projects/${projectId}/settings/report`),
  upsertReportConfig: (projectId: string, data: UpsertReportConfigPayload) =>
    request<ReportConfig>(`/projects/${projectId}/settings/report`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getServerTimezone: (projectId: string) =>
    request<{ timezone: string }>(`/projects/${projectId}/settings/report/server-timezone`),
  testReportConfig: (projectId: string) =>
    request<{ report: { totalTasks: number; totalMembers: number }; results: { channel: string; status: string; detail?: string }[] }>(
      `/projects/${projectId}/settings/report/test`,
      { method: 'POST' },
    ),

  // ─── AI Task Generation ────────────────────────────────────────────────────
  generateTasks: async (projectId: string, data: FormData): Promise<{ jobId: string }> => {
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/ai/generate-tasks`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Generation failed: ${res.status}`);
    }
    return res.json() as Promise<{ jobId: string }>;
  },
  getGenerationJobResult: (projectId: string, jobId: string) =>
    request<AiGenerationJobResult>(`/projects/${projectId}/ai/generate-tasks/${jobId}`),

  // ─── AI Test Case Generation ──────────────────────────────────────────────
  generateTestCases: async (projectId: string, data: FormData): Promise<{ jobId: string }> => {
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/ai/generate-testcases`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Generation failed: ${res.status}`);
    }
    return res.json() as Promise<{ jobId: string }>;
  },
  getTestCaseGenerationJobResult: (projectId: string, jobId: string) =>
    request<AiTestCaseGenerationJobResult>(`/projects/${projectId}/ai/generate-testcases/${jobId}`),

  // ─── AI WBS Generation ──────────────────────────────────────────────────
  generateWbs: async (projectId: string, data: FormData): Promise<{ jobId: string }> => {
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/ai/generate-wbs`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Generation failed: ${res.status}`);
    }
    return res.json() as Promise<{ jobId: string }>;
  },
  getWbsGenerationResult: (projectId: string, jobId: string) =>
    request<AiWbsGenerationJobResult>(`/projects/${projectId}/ai/wbs-generation/${jobId}`),
  wbsChat: (projectId: string, data: { message: string; currentWbs: any[]; chatHistory?: { role: string; content: string }[] }) =>
    request<WbsChatResponse>(`/projects/${projectId}/ai/wbs-chat`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  // ─── Comments ──────────────────────────────────────────────────────────────
  getComments: (projectId: string, taskId: string) =>
    request<Comment[]>(`/projects/${projectId}/tasks/${taskId}/comments`),
  createComment: (projectId: string, taskId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createReply: (projectId: string, taskId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteComment: (projectId: string, taskId: string, commentId: string) =>
    request<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    }),
  updateComment: (projectId: string, taskId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  toggleCommentLike: (projectId: string, taskId: string, commentId: string) =>
    request<ToggleLikeResponse>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}/likes`, {
      method: 'POST',
    }),

  // ─── Attachments ───────────────────────────────────────────────────────────
  getAttachments: (projectId: string, taskId: string) =>
    request<Attachment[]>(`/projects/${projectId}/tasks/${taskId}/attachments`),
  uploadAttachment: async (projectId: string, taskId: string, file: File, inline = false): Promise<Attachment> => {
    const token = keycloak.token;
    const formData = new FormData();
    formData.append('file', file);
    const url = `${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments${inline ? '?inline=true' : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<Attachment>;
  },
  getAttachmentDownloadUrl: (projectId: string, taskId: string, attachmentId: string) =>
    `${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/download`,
  downloadAttachment: async (projectId: string, taskId: string, attachmentId: string): Promise<Blob> => {
    const token = keycloak.token;
    const res = await fetch(
      `${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.blob();
  },
  deleteAttachment: (projectId: string, taskId: string, attachmentId: string) =>
    request<Attachment>(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  // ─── Task History ──────────────────────────────────────────────────────────
  getTaskHistory: (projectId: string, taskId: string) =>
    request<TaskHistoryEntry[]>(`/projects/${projectId}/tasks/${taskId}/history`),

  // ─── Bug History ──────────────────────────────────────────────────────────
  getBugHistory: (projectId: string, bugId: string) =>
    request<BugHistoryEntry[]>(`/projects/${projectId}/bugs/${bugId}/history`),

  // ─── Notifications ──────────────────────────────────────────────────────────
  getNotifications: (params?: { page?: number; limit?: number; isRead?: boolean; type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.isRead !== undefined) sp.set('isRead', String(params.isRead));
    if (params?.type) sp.set('type', params.type);
    const qs = sp.toString();
    return request<NotificationPage>(`/notifications${qs ? `?${qs}` : ''}`);
  },
  getNotificationCount: () =>
    request<{ count: number }>('/notifications/count'),
  markNotificationRead: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<void>('/notifications/read-all', { method: 'PATCH' }),

  // ─── Watchers ───────────────────────────────────────────────────────────────
  getTaskWatchers: (projectId: string, taskId: string) =>
    request<TicketWatcher[]>(`/projects/${projectId}/tasks/${taskId}/watchers`),
  addTaskWatchers: (projectId: string, taskId: string, userIds: string[]) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/watchers`, {
      method: 'POST', body: JSON.stringify({ userIds }),
    }),
  removeTaskWatcher: (projectId: string, taskId: string, userId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/watchers/${userId}`, { method: 'DELETE' }),
  getBugWatchers: (projectId: string, bugId: string) =>
    request<TicketWatcher[]>(`/projects/${projectId}/bugs/${bugId}/watchers`),
  addBugWatchers: (projectId: string, bugId: string, userIds: string[]) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/watchers`, {
      method: 'POST', body: JSON.stringify({ userIds }),
    }),
  removeBugWatcher: (projectId: string, bugId: string, userId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/watchers/${userId}`, { method: 'DELETE' }),

  // ─── Bug Comments ──────────────────────────────────────────────────────────
  getBugComments: (projectId: string, bugId: string) =>
    request<Comment[]>(`/projects/${projectId}/bugs/${bugId}/comments`),
  createBugComment: (projectId: string, bugId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/bugs/${bugId}/comments`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  createBugReply: (projectId: string, bugId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}/replies`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  deleteBugComment: (projectId: string, bugId: string, commentId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}`, { method: 'DELETE' }),
  updateBugComment: (projectId: string, bugId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  toggleBugCommentLike: (projectId: string, bugId: string, commentId: string) =>
    request<ToggleLikeResponse>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}/likes`, {
      method: 'POST',
    }),

  // ─── Test Modules ──────────────────────────────────────────────────────────
  getTestModules: (projectId: string) =>
    request<TestModule[]>(`/projects/${projectId}/test-modules`),
  createTestModule: (projectId: string, data: { name: string; parentId?: string }) =>
    request<TestModule>(`/projects/${projectId}/test-modules`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestModule: (moduleId: string, projectId: string, data: { name?: string; position?: number; parentId?: string }) =>
    request<TestModule>(`/projects/${projectId}/test-modules/${moduleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestModule: (moduleId: string, projectId: string) =>
    request<void>(`/projects/${projectId}/test-modules/${moduleId}`, { method: 'DELETE' }),

  // ─── Test Cases ────────────────────────────────────────────────────────────
  getTestCases: (projectId: string, params?: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    return request<TestCase[]>(`/projects/${projectId}/test-cases${qs ? `?${qs}` : ''}`);
  },
  getTestCase: (projectId: string, testCaseId: string) =>
    request<TestCase>(`/projects/${projectId}/test-cases/${testCaseId}`),
  getTestCaseByKey: (projectId: string, testCaseKey: string) =>
    request<TestCase>(`/projects/${projectId}/test-cases/by-key/${testCaseKey}`),
  createTestCase: (projectId: string, data: CreateTestCasePayload) =>
    request<TestCase>(`/projects/${projectId}/test-cases`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestCase: (projectId: string, testCaseId: string, data: UpdateTestCasePayload) =>
    request<TestCase>(`/projects/${projectId}/test-cases/${testCaseId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestCase: (projectId: string, testCaseId: string) =>
    request<void>(`/projects/${projectId}/test-cases/${testCaseId}`, { method: 'DELETE' }),
  bulkDeleteTestCases: (projectId: string, ids: string[]) =>
    request<{ deleted: number }>(`/projects/${projectId}/test-cases/bulk`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
  bulkAddToSuite: (projectId: string, suiteId: string, testCaseIds: string[]) =>
    request<{ added: number }>(`/projects/${projectId}/test-cases/bulk-suite`, {
      method: 'POST', body: JSON.stringify({ suiteId, testCaseIds }),
    }),
  bulkImportTestCases: (projectId: string, data: BulkImportTestCasesPayload) =>
    request<BulkImportResult>(`/projects/${projectId}/test-cases/bulk-import`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  // ─── Test Suites ──────────────────────────────────────────────────────────
  getTestSuites: (projectId: string) =>
    request<TestSuite[]>(`/projects/${projectId}/test-suites`),
  getTestSuite: (projectId: string, suiteId: string) =>
    request<TestSuite>(`/projects/${projectId}/test-suites/${suiteId}`),
  createTestSuite: (projectId: string, data: CreateTestSuitePayload) =>
    request<TestSuite>(`/projects/${projectId}/test-suites`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestSuite: (projectId: string, suiteId: string, data: UpdateTestSuitePayload) =>
    request<TestSuite>(`/projects/${projectId}/test-suites/${suiteId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestSuite: (projectId: string, suiteId: string) =>
    request<void>(`/projects/${projectId}/test-suites/${suiteId}`, { method: 'DELETE' }),
  addSuiteMembers: (projectId: string, suiteId: string, testCaseIds: string[]) =>
    request<{ added: number }>(`/projects/${projectId}/test-suites/${suiteId}/members`, {
      method: 'POST', body: JSON.stringify({ testCaseIds }),
    }),
  removeSuiteMember: (projectId: string, suiteId: string, testCaseId: string) =>
    request<void>(`/projects/${projectId}/test-suites/${suiteId}/members/${testCaseId}`, { method: 'DELETE' }),

  // ─── Test Executions ──────────────────────────────────────────────────────
  getTestExecutions: (projectId: string) =>
    request<TestExecution[]>(`/projects/${projectId}/test-executions`),
  getTestExecution: (projectId: string, executionId: string) =>
    request<TestExecution>(`/projects/${projectId}/test-executions/${executionId}`),
  getTestExecutionByKey: (projectId: string, executionKey: string) =>
    request<TestExecution>(`/projects/${projectId}/test-executions/by-key/${executionKey}`),
  createTestExecution: (projectId: string, data: CreateTestExecutionPayload) =>
    request<TestExecution>(`/projects/${projectId}/test-executions`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestExecutionStatus: (projectId: string, executionId: string, status: string) =>
    request<void>(`/projects/${projectId}/test-executions/${executionId}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),
  addExecutionCases: (projectId: string, executionId: string, testCaseIds: string[]) =>
    request<{ added: number }>(`/projects/${projectId}/test-executions/${executionId}/cases`, {
      method: 'POST', body: JSON.stringify({ testCaseIds }),
    }),
  deleteTestExecution: (projectId: string, executionId: string) =>
    request<void>(`/projects/${projectId}/test-executions/${executionId}`, { method: 'DELETE' }),
  bulkDeleteTestExecutions: (projectId: string, ids: string[]) =>
    request<{ deleted: number }>(`/projects/${projectId}/test-executions/bulk`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
  updateExecutionCaseResult: (projectId: string, executionCaseId: string, data: { result: string; notes?: string }) =>
    request<TestExecutionCase>(`/projects/${projectId}/test-executions/cases/${executionCaseId}/result`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  uploadExecutionEvidence: async (projectId: string, executionCaseId: string, file: File): Promise<TestExecutionAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/test-executions/cases/${executionCaseId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<TestExecutionAttachment>;
  },
  deleteExecutionEvidence: (projectId: string, attachmentId: string) =>
    request<void>(`/projects/${projectId}/test-executions/attachments/${attachmentId}`, { method: 'DELETE' }),
  getExecutionEvidenceDownloadUrl: (projectId: string, attachmentId: string) =>
    `${API_BASE}/projects/${projectId}/test-executions/attachments/${attachmentId}/download`,

  // ─── Wiki Config ──────────────────────────────────────────────────────
  getWikiConfig: (projectId: string) =>
    request<WikiConfig | null>(`/projects/${projectId}/wiki/config`),
  upsertWikiConfig: (projectId: string, data: UpsertWikiConfigPayload) =>
    request<WikiConfig>(`/projects/${projectId}/wiki/config`, { method: 'PUT', body: JSON.stringify(data) }),

  // ─── Wiki Generation ─────────────────────────────────────────────────
  triggerWikiGeneration: (projectId: string, section?: string) =>
    request<{ jobId: string }>(
      section
        ? `/projects/${projectId}/wiki/generate/${section}`
        : `/projects/${projectId}/wiki/generate`,
      { method: 'POST', body: JSON.stringify(section ? { section } : {}) },
    ),
  getWikiGenerationStatus: (projectId: string, jobId: string) =>
    request<WikiGenerationStatus>(`/projects/${projectId}/wiki/generate/status/${jobId}`),
  getActiveWikiJob: (projectId: string) =>
    request<ActiveWikiJob>(`/projects/${projectId}/wiki/generate/active`),
  abortWikiGeneration: (projectId: string, jobId: string) =>
    request<{ aborted: boolean }>(`/projects/${projectId}/wiki/generate/abort/${jobId}`, { method: 'POST' }),

  // ─── Wiki Content ────────────────────────────────────────────────────
  getWikiPages: (projectId: string) =>
    request<WikiTreeNode[]>(`/projects/${projectId}/wiki/pages`),
  getWikiPage: (projectId: string, pagePath: string) =>
    request<WikiPageContent>(`/projects/${projectId}/wiki/pages/${pagePath}`),
  searchWiki: (projectId: string, query: string) =>
    request<WikiSearchResult[]>(`/projects/${projectId}/wiki/search?q=${encodeURIComponent(query)}`),

  // ─── Wiki Annotations ────────────────────────────────────────────────
  getWikiAnnotations: (projectId: string, pagePath: string) =>
    request<WikiAnnotation[]>(`/projects/${projectId}/wiki/annotations?pagePath=${encodeURIComponent(pagePath)}`),
  createWikiAnnotation: (projectId: string, data: { pagePath: string; sectionRef?: string; content: string }) =>
    request<WikiAnnotation>(`/projects/${projectId}/wiki/annotations`, { method: 'POST', body: JSON.stringify(data) }),
  updateWikiAnnotation: (projectId: string, annotationId: string, content: string) =>
    request<WikiAnnotation>(`/projects/${projectId}/wiki/annotations/${annotationId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteWikiAnnotation: (projectId: string, annotationId: string) =>
    request<void>(`/projects/${projectId}/wiki/annotations/${annotationId}`, { method: 'DELETE' }),

  // ─── Wiki Q&A ────────────────────────────────────────────────────────
  askWiki: (projectId: string, question: string) =>
    request<{ jobId: string }>(`/projects/${projectId}/wiki/qa`, { method: 'POST', body: JSON.stringify({ question }) }),
  getWikiQaHistory: (projectId: string) =>
    request<Array<{ id: string; question: string; answer: string; createdAt: string }>>(`/projects/${projectId}/wiki/qa/history`),
  deleteWikiQa: (projectId: string, qaId: string) =>
    request<void>(`/projects/${projectId}/wiki/qa/${qaId}`, { method: 'DELETE' }),

  // ─── Task Branches ──────────────────────────────────────────────────────
  getRemoteBranches: (projectId: string) =>
    request<string[]>(`/projects/${projectId}/remote-branches`),
  getTaskBranches: (projectId: string, taskId: string) =>
    request<TaskBranch[]>(`/projects/${projectId}/tasks/${taskId}/branches`),
  createTaskBranch: (projectId: string, taskId: string, data: CreateBranchPayload) =>
    request<TaskBranch>(`/projects/${projectId}/tasks/${taskId}/branches`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createTaskPr: (projectId: string, taskId: string, data: CreatePrPayload) =>
    request<TaskBranch>(`/projects/${projectId}/tasks/${taskId}/branches/pr`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteTaskBranch: (projectId: string, taskId: string, branchId: string) =>
    request<{ deleted: boolean }>(`/projects/${projectId}/tasks/${taskId}/branches/${branchId}`, {
      method: 'DELETE',
    }),

  // ─── Planner ─────────────────────────────────────────────

  getPlannerSessions: (projectId: string) =>
    request<PlannerSessionListItem[]>(`/projects/${projectId}/planner-sessions`),

  createPlannerSession: (projectId: string, data: CreatePlannerSessionPayload) =>
    request<PlannerSession>(`/projects/${projectId}/planner-sessions`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  getPlannerSession: (projectId: string, sessionId: string) =>
    request<PlannerSession>(`/projects/${projectId}/planner-sessions/${sessionId}`),

  updatePlannerSession: (projectId: string, sessionId: string, data: UpdatePlannerSessionPayload) =>
    request<PlannerSession>(`/projects/${projectId}/planner-sessions/${sessionId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deletePlannerSession: (projectId: string, sessionId: string) =>
    request<void>(`/projects/${projectId}/planner-sessions/${sessionId}`, { method: 'DELETE' }),

  getPlannerMessages: (sessionId: string, take = 50, skip = 0) =>
    request<PlannerMessage[]>(`/planner-sessions/${sessionId}/messages?take=${take}&skip=${skip}`),

  sendPlannerMessage: async (sessionId: string, content: string, files?: File[]) => {
    const token = keycloak.token;
    const formData = new FormData();
    formData.append('content', content);
    if (files) {
      files.forEach((f) => formData.append('files', f));
    }
    const res = await fetch(`${API_BASE}/planner-sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `API error: ${res.status}`);
    }
    return res.json() as Promise<SendMessageResult>;
  },

  getPlannerScopes: (sessionId: string) =>
    request<PlannerScope[]>(`/planner-sessions/${sessionId}/scopes`),

  createPlannerScope: (sessionId: string, data: CreateScopePayload) =>
    request<PlannerScope>(`/planner-sessions/${sessionId}/scopes`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updatePlannerScope: (sessionId: string, scopeId: string, data: UpdateScopePayload) =>
    request<PlannerScope>(`/planner-sessions/${sessionId}/scopes/${scopeId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deletePlannerScope: (sessionId: string, scopeId: string) =>
    request<void>(`/planner-sessions/${sessionId}/scopes/${scopeId}`, { method: 'DELETE' }),

  reorderPlannerScopes: (sessionId: string, orderedIds: string[]) =>
    request<PlannerScope[]>(`/planner-sessions/${sessionId}/scopes/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  createPlannerFeature: (sessionId: string, scopeId: string, data: CreateFeaturePayload) =>
    request<PlannerFeature>(`/planner-sessions/${sessionId}/scopes/${scopeId}/features`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updatePlannerFeature: (sessionId: string, scopeId: string, featureId: string, data: UpdateFeaturePayload) =>
    request<PlannerFeature>(`/planner-sessions/${sessionId}/scopes/${scopeId}/features/${featureId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deletePlannerFeature: (sessionId: string, scopeId: string, featureId: string) =>
    request<void>(`/planner-sessions/${sessionId}/scopes/${scopeId}/features/${featureId}`, { method: 'DELETE' }),

  reorderPlannerFeatures: (sessionId: string, scopeId: string, orderedIds: string[]) =>
    request<PlannerFeature[]>(`/planner-sessions/${sessionId}/scopes/${scopeId}/features/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  // ─── WBS ───────────────────────────────────────────────────

  // Phases
  getWbsPhases: (projectId: string) =>
    request<WbsPhase[]>(`/projects/${projectId}/wbs/phases`),

  createWbsPhase: (projectId: string, data: CreateWbsPhasePayload) =>
    request<WbsPhase>(`/projects/${projectId}/wbs/phases`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateWbsPhase: (projectId: string, phaseId: string, data: UpdateWbsPhasePayload) =>
    request<WbsPhase>(`/projects/${projectId}/wbs/phases/${phaseId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteWbsPhase: (projectId: string, phaseId: string) =>
    request<void>(`/projects/${projectId}/wbs/phases/${phaseId}`, { method: 'DELETE' }),

  reorderWbsPhases: (projectId: string, orderedIds: string[]) =>
    request<WbsPhase[]>(`/projects/${projectId}/wbs/phases/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  bulkCreateWbs: (projectId: string, data: BulkCreateWbsPayload) =>
    request<WbsPhase[]>(`/projects/${projectId}/wbs/bulk-create`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  // Tasks
  createWbsTask: (phaseId: string, data: CreateWbsTaskPayload) =>
    request<WbsTask>(`/wbs/phases/${phaseId}/tasks`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateWbsTask: (phaseId: string, taskId: string, data: UpdateWbsTaskPayload) =>
    request<WbsTask>(`/wbs/phases/${phaseId}/tasks/${taskId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteWbsTask: (phaseId: string, taskId: string) =>
    request<void>(`/wbs/phases/${phaseId}/tasks/${taskId}`, { method: 'DELETE' }),

  reorderWbsTasks: (phaseId: string, orderedIds: string[]) =>
    request<void>(`/wbs/phases/${phaseId}/tasks/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  // Subtasks
  createWbsSubtask: (taskId: string, data: CreateWbsSubtaskPayload) =>
    request<WbsSubtask>(`/wbs/tasks/${taskId}/subtasks`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateWbsSubtask: (taskId: string, subtaskId: string, data: UpdateWbsSubtaskPayload) =>
    request<WbsSubtask>(`/wbs/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteWbsSubtask: (taskId: string, subtaskId: string) =>
    request<void>(`/wbs/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),

  reorderWbsSubtasks: (taskId: string, orderedIds: string[]) =>
    request<void>(`/wbs/tasks/${taskId}/subtasks/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  // Dependencies
  getWbsDependencies: (projectId: string) =>
    request<WbsDependency[]>(`/projects/${projectId}/wbs/dependencies`),

  createWbsDependency: (projectId: string, data: CreateWbsDependencyPayload) =>
    request<WbsDependency>(`/projects/${projectId}/wbs/dependencies`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteWbsDependency: (projectId: string, depId: string) =>
    request<void>(`/projects/${projectId}/wbs/dependencies/${depId}`, { method: 'DELETE' }),

  // Backlog linking
  linkWbsTaskBacklog: (taskId: string, data: LinkBacklogPayload) =>
    request<WbsTask>(`/wbs/tasks/${taskId}/link-backlog`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  unlinkWbsTaskBacklog: (taskId: string) =>
    request<WbsTask>(`/wbs/tasks/${taskId}/link-backlog`, { method: 'DELETE' }),

  linkWbsSubtaskBacklog: (subtaskId: string, data: LinkBacklogPayload) =>
    request<WbsSubtask>(`/wbs/subtasks/${subtaskId}/link-backlog`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  unlinkWbsSubtaskBacklog: (subtaskId: string) =>
    request<WbsSubtask>(`/wbs/subtasks/${subtaskId}/link-backlog`, { method: 'DELETE' }),

  // ─── Test Automation ──────────────────────────────────────────
  getAutomation: (testCaseId: string) =>
    request<TestCaseAutomation | null>(`/test-automation/${testCaseId}`),

  upsertAutomation: (testCaseId: string, data: { script: string; baseUrl?: string; timeoutMs?: number }) =>
    request<TestCaseAutomation>(`/test-automation/${testCaseId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAutomation: (testCaseId: string) =>
    request<void>(`/test-automation/${testCaseId}`, { method: 'DELETE' }),

  triggerAutomationRun: (testCaseId: string) =>
    request<AutomationRun>(`/test-automation/${testCaseId}/run`, { method: 'POST' }),

  cancelAutomationRun: (runId: string) =>
    request<{ cancelled: boolean }>(`/test-automation/runs/${runId}/cancel`, { method: 'DELETE' }),

  getAutomationRuns: (testCaseId: string) =>
    request<AutomationRun[]>(`/test-automation/${testCaseId}/runs`),

  generateAutomationScript: (testCaseId: string, targetUrl: string) =>
    request<{ script: string }>(
      `/test-automation/${testCaseId}/generate-script`,
      { method: 'POST', body: JSON.stringify({ targetUrl }) },
    ),

  // ─── Project Variables ────────────────────────────────────────
  getProjectVariables: (projectId: string) =>
    request<ProjectVariable[]>(`/projects/${projectId}/variables`),

  createProjectVariable: (projectId: string, data: { key: string; value: string; isSecret?: boolean }) =>
    request<ProjectVariable>(`/projects/${projectId}/variables`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProjectVariable: (id: string, projectId: string, data: { value?: string; isSecret?: boolean }) =>
    request<ProjectVariable>(`/projects/${projectId}/variables/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteProjectVariable: (id: string, projectId: string) =>
    request<void>(`/projects/${projectId}/variables/${id}`, { method: 'DELETE' }),
};
