# Sidebar & URL UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix sidebar collapse/expand UX, add logout button, and replace UUID-based project/task URLs with human-readable prefix/taskKey identifiers.

**Architecture:** The backend already exposes `GET /projects/by-prefix/:prefix` and `findByTaskKey()`. The frontend already has `useProjectByPrefix`. The approach: (1) add one new backend endpoint for task-by-key lookup, (2) update routes to use `:projectPrefix` and `:taskKey`, (3) have `ProjectLayout` resolve prefix → UUID and store it in `uiStore.activeProjectId` so all child pages keep working, (4) move sidebar toggle to header and add logout to footer.

**Tech Stack:** NestJS (backend), React 19 + React Router + TanStack Query + Zustand (frontend), Vitest (tests), TypeScript throughout.

---

## File Map

| File | Change |
|------|--------|
| `apps/api/src/tasks/tasks.controller.ts` | Add `GET by-key/:taskKey` route before existing `GET :taskId` |
| `apps/web/src/lib/api.ts` | Add `getTaskByKey(projectId, taskKey)` |
| `apps/web/src/hooks/useTasks.ts` | Add `useTaskByKey(projectId, taskKey)` |
| `apps/web/src/App.tsx` | Routes: `:projectId` → `:projectPrefix`, `:taskId` → `:taskKey` |
| `apps/web/src/components/layout/ProjectLayout.tsx` | Resolve prefix → UUID via `useProjectByPrefix`, set `activeProjectId` |
| `apps/web/src/components/layout/AppSidebar.tsx` | Toggle in header, logout in footer, navigate with prefix |
| `apps/web/src/pages/TaskDetailPage.tsx` | Read `taskKey` from params + `projectId` from store; fetch via `useTaskByKey` |
| `apps/web/src/components/tasks/KanbanCard.tsx` | Navigate using `task.taskKey ?? task.id` |
| `apps/web/src/components/tasks/TasksTable.tsx` | Navigate using `task.taskKey ?? task.id` |
| `apps/web/src/pages/ProjectDashboardPage.tsx` | `projectId` from store instead of params |
| `apps/web/src/pages/BacklogPage.tsx` | `projectId` from store instead of params |
| `apps/web/src/pages/SprintsPage.tsx` | `projectId` from store instead of params |
| `apps/web/src/pages/SprintBoardPage.tsx` | `projectId` from store; keep `sprintId` from params |
| `apps/web/src/pages/BugsPage.tsx` | `projectId` from store instead of params |
| `apps/web/src/pages/BugDetailPage.tsx` | `projectId` from store; keep `bugId` from params |
| `apps/web/src/pages/MembersPage.tsx` | `projectId` from store instead of params |
| `apps/web/src/pages/ProjectSettingsPage.tsx` | `projectId` from store instead of params |

---

## Task 1: Add `by-key` endpoint to tasks controller (backend)

**Files:**
- Modify: `apps/api/src/tasks/tasks.controller.ts`

`tasksService.findByTaskKey()` already exists. We just need to expose it. The new route **must** be declared before `GET :taskId` — otherwise NestJS will match `by-key` as a `:taskId` value.

- [ ] **Step 1: Add the route before the existing `GET :taskId` handler**

Open `apps/api/src/tasks/tasks.controller.ts`. Replace the existing `findOne` block:

```typescript
// BEFORE (lines 40-48):
  @Get(':taskId/history')
  getHistory(@Param('taskId') taskId: string) {
    return this.tasksService.getHistory(taskId);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }
```

```typescript
// AFTER:
  @Get('by-key/:taskKey')
  findByKey(@Param('taskKey') taskKey: string) {
    return this.tasksService.findByTaskKey(taskKey);
  }

  @Get(':taskId/history')
  getHistory(@Param('taskId') taskId: string) {
    return this.tasksService.getHistory(taskId);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }
```

- [ ] **Step 2: Verify the server compiles**

```bash
cd apps/api && npx ts-node -e "console.log('ok')" 2>&1 | tail -3
```

Expected: no TypeScript errors. If the project has a start script, run `npm run build` instead.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/tasks.controller.ts
git commit -m "feat: expose findByTaskKey as GET tasks/by-key/:taskKey"
```

---

## Task 2: Add `getTaskByKey` to api.ts and `useTaskByKey` to useTasks.ts

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useTasks.ts`

- [ ] **Step 1: Add `getTaskByKey` to api.ts**

In `apps/web/src/lib/api.ts`, find the `getTask` line (currently line 107) and add immediately after:

```typescript
  getTask: (projectId: string, taskId: string) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`),
  getTaskByKey: (projectId: string, taskKey: string) =>
    request<Task>(`/projects/${projectId}/tasks/by-key/${taskKey}`),
```

- [ ] **Step 2: Add `useTaskByKey` to useTasks.ts**

In `apps/web/src/hooks/useTasks.ts`, after the existing `useTask` function (currently ends around line 20), add:

```typescript
export function useTaskByKey(projectId: string, taskKey: string) {
  return useQuery({
    queryKey: ['task-by-key', projectId, taskKey],
    queryFn: () => api.getTaskByKey(projectId, taskKey),
    enabled: !!projectId && !!taskKey,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useTasks.ts
git commit -m "feat: add getTaskByKey api method and useTaskByKey hook"
```

---

## Task 3: Update routes in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

Replace every occurrence of `:projectId` with `:projectPrefix` and `:taskId` with `:taskKey` in the route paths.

- [ ] **Step 1: Update App.tsx**

Replace the full routes block (lines 27–37) with:

```typescript
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectPrefix/dashboard" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectPrefix/backlog" element={<BacklogPage />} />
        <Route path="/projects/:projectPrefix/sprints" element={<SprintsPage />} />
        <Route path="/projects/:projectPrefix/sprints/:sprintId" element={<SprintBoardPage />} />
        <Route path="/projects/:projectPrefix/bugs" element={<BugsPage />} />
        <Route path="/projects/:projectPrefix/members" element={<MembersPage />} />
        <Route path="/projects/:projectPrefix/settings" element={<ProjectSettingsPage />} />
        <Route path="/projects/:projectPrefix/tasks/:taskKey" element={<TaskDetailPage />} />
        <Route path="/projects/:projectPrefix/bugs/:bugId" element={<BugDetailPage />} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: update routes to use projectPrefix and taskKey params"
```

---

## Task 4: Update ProjectLayout to resolve prefix → UUID

**Files:**
- Modify: `apps/web/src/components/layout/ProjectLayout.tsx`

`ProjectLayout` must now read `projectPrefix` from params, fetch the project by prefix, and set `activeProjectId` to the resolved UUID. Child pages read `activeProjectId` from the store to get the UUID for API calls.

- [ ] **Step 1: Rewrite ProjectLayout.tsx**

Replace the full file content:

```typescript
import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useUiStore } from '@/store/uiStore';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CreateProjectDialog } from '../projects/CreateProjectDialog';
import { useProjectByPrefix } from '@/hooks/useProjects';

// 256px expanded, 48px collapsed — per UI-SPEC
const SIDEBAR_WIDTH = '256px';
const SIDEBAR_WIDTH_COLLAPSED = '48px';

export function ProjectLayout() {
  const { projectPrefix } = useParams<{ projectPrefix: string }>();
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Resolve human-readable prefix to project UUID
  const { data: project } = useProjectByPrefix(projectPrefix ?? '');

  useEffect(() => {
    setActiveProjectId(project?.id ?? null);
    return () => {
      // Don't clear on unmount — sidebar should retain project context
    };
  }, [project?.id, setActiveProjectId]);

  return (
    <SidebarProvider
      defaultOpen={!sidebarCollapsed}
      open={!sidebarCollapsed}
      onOpenChange={(open) => setSidebarCollapsed(!open)}
      style={
        {
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_COLLAPSED,
        } as React.CSSProperties
      }
    >
      <AppSidebar onCreateProject={() => setCreateProjectOpen(true)} />
      <SidebarInset>
        <main className="px-8 pt-6 pb-8 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
      </SidebarInset>
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/ProjectLayout.tsx
git commit -m "feat: resolve projectPrefix to UUID in ProjectLayout via useProjectByPrefix"
```

---

## Task 5: Update AppSidebar — toggle in header, logout in footer, prefix navigation

**Files:**
- Modify: `apps/web/src/components/layout/AppSidebar.tsx`

Three changes in one file: (1) move collapse toggle to the header, (2) add logout button in footer, (3) use `project.prefix` for navigation links.

- [ ] **Step 1: Rewrite AppSidebar.tsx**

Replace the full file:

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Zap,
  Bug,
  Users,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';

const PROJECT_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Backlog', icon: ListTodo, path: 'backlog' },
  { label: 'Sprints', icon: Zap, path: 'sprints' },
  { label: 'Bugs', icon: Bug, path: 'bugs' },
  { label: 'Members', icon: Users, path: 'members' },
  { label: 'Settings', icon: Settings, path: 'settings' },
];

function SidebarCollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebar}
          className="size-8 shrink-0"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}

interface AppSidebarInnerProps {
  onCreateProject: () => void;
}

function AppSidebarInner({ onCreateProject }: AppSidebarInnerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { data: projects } = useProjects();
  const { user, logout } = useAuth();
  const activeProjectId = useUiStore((s) => s.activeProjectId);

  const userInitials = user?.username
    ? user.username.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const userName = user?.username ?? user?.email ?? 'User';

  // Find the active project to get its prefix for URL generation
  const activeProject = projects?.find((p) => p.id === activeProjectId);
  const activeProjectPrefix = activeProject?.prefix ?? activeProjectId ?? '';

  return (
    <Sidebar collapsible="icon">
      {/* Header: logo + collapse toggle */}
      <SidebarHeader className="h-12 flex items-center px-2">
        {isCollapsed ? (
          <div className="flex justify-center w-full">
            <SidebarCollapseButton />
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src="/favicon.svg"
              alt="Logo"
              className="size-6 shrink-0 cursor-pointer"
              onClick={() => navigate('/')}
            />
            <span
              className="font-semibold text-base tracking-tight truncate cursor-pointer flex-1"
              onClick={() => navigate('/')}
            >
              PulseTrack
            </span>
            <SidebarCollapseButton />
          </div>
        )}
      </SidebarHeader>

      <Separator />

      <SidebarContent className="overflow-hidden">
        {/* Projects section */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[13px] font-semibold">
              Projects
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {(projects ?? []).map((project) => {
              const projectIdentifier = project.prefix ?? project.id;
              const isActive = location.pathname.startsWith(`/projects/${projectIdentifier}`);
              return (
                <SidebarMenuItem key={project.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={isActive}
                        aria-label={project.name}
                        onClick={() => navigate(`/projects/${projectIdentifier}/dashboard`)}
                        className="cursor-pointer"
                      >
                        {project.avatarUrl ? (
                          <img src={project.avatarUrl} alt={`${project.name} avatar`} className="size-4 rounded" />
                        ) : (
                          <FolderKanban className="size-4" />
                        )}
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">{project.name}</TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              );
            })}

            {/* New Project button */}
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    aria-label="New Project"
                    onClick={onCreateProject}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-medium">+</span>
                    {!isCollapsed && <span>New Project</span>}
                  </SidebarMenuButton>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">New Project</TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Project nav section (visible when inside a project) */}
        {activeProjectId && (
          <>
            <Separator />
            <SidebarGroup>
              {!isCollapsed && (
                <SidebarGroupLabel className="text-[13px] font-semibold truncate">
                  {activeProject?.name ?? 'Project'}
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {PROJECT_NAV_ITEMS.map((item) => {
                  const href = `/projects/${activeProjectPrefix}/${item.path}`;
                  const isActive = location.pathname === href;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            aria-label={item.label}
                            onClick={() => navigate(href)}
                            className="cursor-pointer"
                          >
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer: user info + logout */}
      <SidebarFooter>
        <Separator />
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="size-7 cursor-default">
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">{userName}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  onClick={logout}
                  className="size-8"
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 h-12">
            <Avatar className="size-7 shrink-0 cursor-default">
              <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
            </Avatar>
            <span className="text-sm truncate text-sidebar-foreground flex-1">{userName}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  onClick={logout}
                  className="size-8 shrink-0"
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

interface AppSidebarProps {
  onCreateProject?: () => void;
}

export function AppSidebar({ onCreateProject = () => {} }: AppSidebarProps) {
  return <AppSidebarInner onCreateProject={onCreateProject} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/AppSidebar.tsx
git commit -m "feat: move sidebar toggle to header, add logout button, navigate with project prefix"
```

---

## Task 6: Update TaskDetailPage to use taskKey and useTaskByKey

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`

The page now reads `taskKey` from URL params and `projectId` (UUID) from the uiStore. After fetching the task by key, `task.id` (UUID) is used for all mutations.

- [ ] **Step 1: Update the import and hook calls at the top of `TaskDetailPage`**

In `apps/web/src/pages/TaskDetailPage.tsx`, find the `useTask` import (line 37):

```typescript
import { useTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
```

Replace with:

```typescript
import { useTaskByKey, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useUiStore } from '@/store/uiStore';
```

- [ ] **Step 2: Update `useParams` destructuring and hook calls in `TaskDetailPage` function**

Find (around line 165):
```typescript
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: task, isLoading, isError } = useTask(projectId, taskId);
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { canManage, canEdit } = useProjectRole(projectId);
  const { data: project } = useProject(projectId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
```

Replace with:

```typescript
  const { taskKey = '' } = useParams<{ taskKey: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: task, isLoading, isError } = useTaskByKey(projectId, taskKey);
  const taskId = task?.id ?? '';
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { canManage, canEdit } = useProjectRole(projectId);
  const { data: project } = useProject(projectId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
```

- [ ] **Step 3: Update subtask mutation cache invalidations**

In `TaskDetailPage`, the subtask mutations currently invalidate `['task', projectId, taskId]`. After the change, the task is cached under `['task-by-key', projectId, taskKey]`. Update all three subtask `onSuccess` handlers.

Find in `createSubTask` mutation:
```typescript
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
```
Replace with:
```typescript
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
```

Find in `updateSubTask` mutation:
```typescript
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
```
Replace with:
```typescript
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
```

Find in `deleteSubTask` mutation:
```typescript
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
```
Replace with:
```typescript
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
```

- [ ] **Step 4: Update `updateTask.mutate` calls to also invalidate the by-key cache**

In `TaskDetailPage`, search for all calls to `updateTask.mutate(...)`. These need an extra `onSettled` callback to invalidate the by-key cache. Each call looks like:

```typescript
updateTask.mutate({ taskId: task.id, data: { ... } });
```

Wrap each with the invalidation callback:

```typescript
updateTask.mutate(
  { taskId: task.id, data: { ... } },
  { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
);
```

Do this for every `updateTask.mutate(` call in the file. Use search-and-inspect to find them all — there are typically 5–8 (status, assignee, sprint, story points, priority, dates, title, acceptance criteria).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx
git commit -m "feat: TaskDetailPage fetches by taskKey from URL, mutations use task.id UUID"
```

---

## Task 7: Update KanbanCard and TasksTable navigation

**Files:**
- Modify: `apps/web/src/components/tasks/KanbanCard.tsx`
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`

Both files navigate to task detail using `task.id`. Switch to `task.taskKey ?? task.id` so tasks with a key get clean URLs; tasks without a key (edge case) fall back to UUID.

- [ ] **Step 1: Update KanbanCard.tsx**

In `apps/web/src/components/tasks/KanbanCard.tsx`, find (around line 59):

```typescript
      navigate(`/projects/${projectId}/tasks/${task.id}`);
```

Replace with:

```typescript
      navigate(`/projects/${projectId}/tasks/${task.taskKey ?? task.id}`);
```

Note: `projectId` prop passed to `KanbanCard` is the UUID (from the parent page which reads from uiStore). But the route now uses prefix, not UUID. We need to get the prefix here.

Check how `KanbanCard` receives `projectId` — it's passed as a prop. The parent (`KanbanBoard` or the page) passes `projectId` (UUID). We need to pass the prefix instead.

Open `apps/web/src/components/tasks/KanbanCard.tsx` line 12–15:

```typescript
interface KanbanCardProps {
  task: Task;
  projectId: string;
}
```

Change the prop to `projectPrefix`:

```typescript
interface KanbanCardProps {
  task: Task;
  projectPrefix: string;
}
```

Update the destructuring in the component function from `{ task, projectId }` to `{ task, projectPrefix }`.

Update the navigate call:

```typescript
      navigate(`/projects/${projectPrefix}/tasks/${task.taskKey ?? task.id}`);
```

- [ ] **Step 2: Update KanbanBoard to pass projectPrefix**

Open `apps/web/src/components/tasks/KanbanBoard.tsx`. Find where `KanbanCard` is rendered and where `projectId` is passed to it.

Search for `<KanbanCard` in the file. The `KanbanBoard` component receives `projectId` as a prop from the page. We need to also receive `projectPrefix` and pass it to `KanbanCard`.

In `KanbanBoard.tsx`, find the `KanbanBoardProps` interface and add `projectPrefix: string`. Then pass it down to `KanbanCard`:

```typescript
// In KanbanBoardProps interface — add:
projectPrefix: string;

// Where KanbanCard is rendered — change:
<KanbanCard task={task} projectId={projectId} />
// to:
<KanbanCard task={task} projectPrefix={projectPrefix} />
```

- [ ] **Step 3: Update pages that use KanbanBoard to pass projectPrefix**

`KanbanBoard` is used in `BacklogPage` and `SprintBoardPage`. In each, find the `<KanbanBoard` usage and add `projectPrefix`.

In `apps/web/src/pages/BacklogPage.tsx`:
```typescript
// Find:
<KanbanBoard projectId={projectId} ... />
// Add projectPrefix. The prefix comes from the projects list.
// BacklogPage already uses useUiStore for projectId (after Task 8).
// Add: const { data: projects } = useProjects(); then find the active project.
// Or simpler: use useParams to get the prefix directly since it's in the URL.
const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
// Then pass:
<KanbanBoard projectId={projectId} projectPrefix={projectPrefix} ... />
```

In `apps/web/src/pages/SprintBoardPage.tsx`:
```typescript
// Same pattern — add:
const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
// Pass to KanbanBoard:
<KanbanBoard projectId={projectId} projectPrefix={projectPrefix} ... />
```

- [ ] **Step 4: Update TasksTable navigation**

In `apps/web/src/components/tasks/TasksTable.tsx`, find (around line 394):

```typescript
                  onClick={() => navigate(`/projects/${projectId}/tasks/${row.original.id}`)}
```

Replace with:

```typescript
                  onClick={() => navigate(`/projects/${projectId}/tasks/${row.original.taskKey ?? row.original.id}`)}
```

Note: `TasksTable` receives `projectId` as a prop. This is the UUID. The route now uses prefix. Find the `TasksTable` props interface and the `projectId` prop — similar to KanbanCard, we need the prefix. Check if `TasksTable` has a `projectId` prop or reads from params. If it receives it as a prop, rename to `projectPrefix` or add a `projectPrefix` prop alongside `projectId`. Use the same approach as KanbanCard/KanbanBoard: add `projectPrefix` prop, thread it from the parent pages.

If `TasksTable` only uses `projectId` for navigation (not for API calls), replace the `projectId` navigation usage with `projectPrefix`. If it also uses `projectId` for API calls, keep both props.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tasks/KanbanCard.tsx \
        apps/web/src/components/tasks/KanbanBoard.tsx \
        apps/web/src/components/tasks/TasksTable.tsx \
        apps/web/src/pages/BacklogPage.tsx \
        apps/web/src/pages/SprintBoardPage.tsx
git commit -m "feat: navigate to task detail using taskKey and projectPrefix"
```

---

## Task 8: Update child pages — get projectId from uiStore instead of useParams

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage.tsx`
- Modify: `apps/web/src/pages/BacklogPage.tsx`
- Modify: `apps/web/src/pages/SprintsPage.tsx`
- Modify: `apps/web/src/pages/SprintBoardPage.tsx`
- Modify: `apps/web/src/pages/BugsPage.tsx`
- Modify: `apps/web/src/pages/BugDetailPage.tsx`
- Modify: `apps/web/src/pages/MembersPage.tsx`
- Modify: `apps/web/src/pages/ProjectSettingsPage.tsx`

`ProjectLayout` now stores the resolved UUID in `uiStore.activeProjectId`. All child pages that previously read `projectId` from `useParams` must now read it from the store.

**Pattern for pages with only `projectId` from params:**

```typescript
// BEFORE:
import { useParams } from 'react-router-dom';
// ...
const { projectId = '' } = useParams<{ projectId: string }>();

// AFTER (remove useParams import if it's no longer used; keep if other params remain):
import { useUiStore } from '@/store/uiStore';
// ...
const projectId = useUiStore((s) => s.activeProjectId) ?? '';
```

**Pattern for pages with additional params (`sprintId`, `bugId`):**

```typescript
// BEFORE (SprintBoardPage):
const { projectId = '', sprintId = '' } = useParams<{ projectId: string; sprintId: string }>();

// AFTER:
const { sprintId = '' } = useParams<{ sprintId: string }>();
const projectId = useUiStore((s) => s.activeProjectId) ?? '';
import { useUiStore } from '@/store/uiStore';
```

Apply the changes file by file:

- [ ] **Step 1: ProjectDashboardPage.tsx**

Line 1: add `import { useUiStore } from '@/store/uiStore';`
Line 32: `const { projectId } = useParams<{ projectId: string }>();` → `const projectId = useUiStore((s) => s.activeProjectId) ?? '';`
If `useParams` is no longer imported for any other purpose, remove its import.

- [ ] **Step 2: BacklogPage.tsx**

BacklogPage already imports `useUiStore`. Line 19: `const { projectId = '' } = useParams<{ projectId: string }>();` → `const projectId = useUiStore((s) => s.activeProjectId) ?? '';`
Keep `useParams` import only if `projectPrefix` is also read (for KanbanBoard — see Task 7 Step 3).

- [ ] **Step 3: SprintsPage.tsx**

Add `import { useUiStore } from '@/store/uiStore';`
Line 14: `const { projectId = '' } = useParams<{ projectId: string }>();` → `const projectId = useUiStore((s) => s.activeProjectId) ?? '';`
Remove `useParams` import if unused.

- [ ] **Step 4: SprintBoardPage.tsx**

Add `import { useUiStore } from '@/store/uiStore';`
Line 27: `const { projectId = '', sprintId = '' } = useParams<{ projectId: string; sprintId: string }>();` →
```typescript
const { sprintId = '', projectPrefix = '' } = useParams<{ sprintId: string; projectPrefix: string }>();
const projectId = useUiStore((s) => s.activeProjectId) ?? '';
```
(Keep `projectPrefix` from params for passing to `KanbanBoard` as per Task 7 Step 3.)

- [ ] **Step 5: BugsPage.tsx**

Add `import { useUiStore } from '@/store/uiStore';`
Line 14: `const { projectId = '' } = useParams<{ projectId: string }>();` → `const projectId = useUiStore((s) => s.activeProjectId) ?? '';`
Remove `useParams` import if unused.

- [ ] **Step 6: BugDetailPage.tsx**

Add `import { useUiStore } from '@/store/uiStore';`
Line 71: `const { projectId = '', bugId = '' } = useParams<{ projectId: string; bugId: string }>();` →
```typescript
const { bugId = '' } = useParams<{ bugId: string }>();
const projectId = useUiStore((s) => s.activeProjectId) ?? '';
```

- [ ] **Step 7: MembersPage.tsx**

Add `import { useUiStore } from '@/store/uiStore';`
Line 29: `const { projectId } = useParams<{ projectId: string }>();` → `const projectId = useUiStore((s) => s.activeProjectId) ?? '';`
Remove `useParams` import if unused.

- [ ] **Step 8: ProjectSettingsPage.tsx**

Add `import { useUiStore } from '@/store/uiStore';`
Line 14: `const { projectId = '' } = useParams<{ projectId: string }>();` → `const projectId = useUiStore((s) => s.activeProjectId) ?? '';`
Remove `useParams` import if unused.

- [ ] **Step 9: Commit all child page changes**

```bash
git add \
  apps/web/src/pages/ProjectDashboardPage.tsx \
  apps/web/src/pages/BacklogPage.tsx \
  apps/web/src/pages/SprintsPage.tsx \
  apps/web/src/pages/SprintBoardPage.tsx \
  apps/web/src/pages/BugsPage.tsx \
  apps/web/src/pages/BugDetailPage.tsx \
  apps/web/src/pages/MembersPage.tsx \
  apps/web/src/pages/ProjectSettingsPage.tsx
git commit -m "feat: child pages read projectId UUID from uiStore instead of URL params"
```

---

## Task 9: Verify and smoke-test

- [ ] **Step 1: Check TypeScript compilation for the frontend**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -50
```

Expected: zero errors. If there are errors, fix them before proceeding. Common issues: missing `projectPrefix` prop on `KanbanBoard`, stale `projectId` param references, missing imports.

- [ ] **Step 2: Check TypeScript compilation for the backend**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke-test checklist**

Start the dev server and verify:

1. **Project URL** — Navigate to a project. The URL should be `/projects/HRM/dashboard` (your prefix), not a UUID.
2. **Task URL** — Click a task from the backlog or kanban. URL should be `/projects/HRM/tasks/HRM-1`, not a UUID.
3. **Sidebar collapse** — Click the ChevronLeft in the header. Sidebar collapses. Click ChevronRight. Sidebar expands. Both work.
4. **Logout button** — Expanded state: LogOut icon visible in footer. Collapsed state: LogOut icon visible. Clicking it redirects to Keycloak login page.
5. **Sidebar nav** — When inside a project, clicking Dashboard/Backlog/Sprints/Bugs/Members/Settings navigates correctly.
6. **Project switching** — Click a different project in the sidebar. URL changes to the new project's prefix. Page data refreshes.
7. **Task mutations** — Open a task detail. Change status. Verify the change persists (no stale data showing).

- [ ] **Step 4: Final commit if any last-minute fixes were applied**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: address TypeScript errors and smoke-test findings"
```
