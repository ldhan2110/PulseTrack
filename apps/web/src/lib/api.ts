import type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  Member,
  AddMemberPayload,
  AddMembersPayload,
  ChangeRolePayload,
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
  CreateBugPayload,
  UpdateBugPayload,
  DashboardData,
  Comment,
  CreateCommentPayload,
  Attachment,
  TaskHistoryEntry,
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
} from './types';
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

  // ─── Bug Attachments ──────────────────────────────────────────────────────
  getBugAttachments: (projectId: string, bugId: string) =>
    request<BugAttachment[]>(`/projects/${projectId}/bugs/${bugId}/attachments`),
  uploadBugAttachment: async (projectId: string, bugId: string, file: File): Promise<BugAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const token = keycloak.token;
    const url = `${API_BASE}/projects/${projectId}/bugs/${bugId}/attachments`;
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
  deleteBugAttachment: (projectId: string, bugId: string, attachmentId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/attachments/${attachmentId}`, { method: 'DELETE' }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getDashboard: (projectId: string) =>
    request<DashboardData>(`/projects/${projectId}/dashboard`),

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
};
