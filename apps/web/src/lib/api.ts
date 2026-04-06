import type {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  Member,
  AddMemberPayload,
  ChangeRolePayload,
  UserSearchResult,
  Task,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubTaskPayload,
  UpdateSubTaskPayload,
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
  return res.json() as Promise<T>;
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

  // ─── Members ───────────────────────────────────────────────────────────────
  getMembers: (projectId: string) =>
    request<Member[]>(`/projects/${projectId}/members`),
  addMember: (projectId: string, data: AddMemberPayload) =>
    request<Member>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  searchUsers: (projectId: string, query: string) =>
    request<UserSearchResult[]>(`/projects/${projectId}/members/search?q=${encodeURIComponent(query)}`),
  changeMemberRole: (projectId: string, memberId: string, data: ChangeRolePayload) =>
    request<void>(`/projects/${projectId}/members/${memberId}/role`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeMember: (projectId: string, memberId: string) =>
    request<void>(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  getTasks: (projectId: string) =>
    request<Task[]>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: CreateTaskPayload) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getTask: (projectId: string, taskId: string) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`),
  updateTask: (projectId: string, taskId: string, data: UpdateTaskPayload) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (projectId: string, taskId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  createSubTask: (projectId: string, taskId: string, data: CreateSubTaskPayload) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateSubTask: (projectId: string, taskId: string, subTaskId: string, data: UpdateSubTaskPayload) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subTaskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSubTask: (projectId: string, taskId: string, subTaskId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subTaskId}`, { method: 'DELETE' }),

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
  updateBug: (projectId: string, bugId: string, data: UpdateBugPayload) =>
    request<Bug>(`/projects/${projectId}/bugs/${bugId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBug: (projectId: string, bugId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}`, { method: 'DELETE' }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getDashboard: (projectId: string) =>
    request<DashboardData>(`/projects/${projectId}/dashboard`),

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

  // ─── Attachments ───────────────────────────────────────────────────────────
  getAttachments: (projectId: string, taskId: string) =>
    request<Attachment[]>(`/projects/${projectId}/tasks/${taskId}/attachments`),
  uploadAttachment: async (projectId: string, taskId: string, file: File): Promise<Attachment> => {
    const token = keycloak.token;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments`, {
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
  deleteAttachment: (projectId: string, taskId: string, attachmentId: string) =>
    request<Attachment>(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  // ─── Task History ──────────────────────────────────────────────────────────
  getTaskHistory: (projectId: string, taskId: string) =>
    request<TaskHistoryEntry[]>(`/projects/${projectId}/tasks/${taskId}/history`),
};
