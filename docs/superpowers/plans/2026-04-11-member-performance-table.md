# Member Performance Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the RecentActivity dashboard component with a visual member performance table showing workload (stacked bars), hours logged, efficiency, quality (heat blocks), and bug counts per team member.

**Architecture:** Add a `getMemberPerformance()` method to the existing `DashboardService` that aggregates task, time-log, and bug data per project member. Integrate the result into the existing `getProjectDashboard()` response. On the frontend, create a new `MemberPerformance.tsx` component with inline SVG/CSS visualizations (stacked bars, heat blocks, trend arrows) and a time-filter dropdown. Remove `RecentActivity.tsx`.

**Tech Stack:** NestJS + Prisma (backend), React + TanStack Query + shadcn/ui (frontend), Vitest (tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/dashboard/dashboard.service.ts` | Modify | Add `getMemberPerformance()` method, integrate into `getProjectDashboard()` |
| `apps/api/src/dashboard/dashboard.controller.ts` | Modify | Add optional `timeFilter` query param |
| `apps/api/src/dashboard/dashboard.service.spec.ts` | Modify | Add tests for `getMemberPerformance()` |
| `apps/web/src/lib/types.ts` | Modify | Add `MemberPerformanceRow` type, update `DashboardData` |
| `apps/web/src/components/dashboard/MemberPerformance.tsx` | Create | New visual table component |
| `apps/web/src/pages/ProjectDashboardPage.tsx` | Modify | Swap RecentActivity for MemberPerformance |
| `apps/web/src/components/dashboard/RecentActivity.tsx` | Delete | No longer needed |

---

### Task 1: Backend — Add `getMemberPerformance()` to DashboardService

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.service.ts:1-226`
- Modify: `apps/api/src/dashboard/dashboard.service.spec.ts:1-213`

- [ ] **Step 1: Write the failing test for getMemberPerformance**

Add this test block inside the existing `describe('DashboardService')` in `apps/api/src/dashboard/dashboard.service.spec.ts`, after the existing tests. Also add `projectMember`, `timeLog`, and `bug.groupBy` mocks to `mockPrismaService`:

```typescript
// Add these to mockPrismaService (around line 22):
// projectMember: { findMany: vi.fn() },
// timeLog: { groupBy: vi.fn() },
// And add groupBy to bug: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },

describe('getMemberPerformance()', () => {
  it('returns aggregated performance data per member', async () => {
    const projectId = 'proj-1';

    // Mock project members
    mockPrismaService.projectMember.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        user: { id: 'user-1', name: 'John Doe', imageUrl: null },
      },
      {
        userId: 'user-2',
        user: { id: 'user-2', name: 'Sarah Adams', imageUrl: 'https://example.com/sarah.jpg' },
      },
    ]);

    // Mock workflow statuses (TASK kind)
    mockPrismaService.workflowStatus.findMany.mockResolvedValue([
      { id: 'ws-backlog', isClosed: false },
      { id: 'ws-in-progress', isClosed: false },
      { id: 'ws-done', isClosed: true },
    ]);

    // Mock tasks grouped by [assigneeId, workflowStatusId]
    mockPrismaService.task.groupBy.mockResolvedValue([
      { assigneeId: 'user-1', workflowStatusId: 'ws-done', _count: 10 },
      { assigneeId: 'user-1', workflowStatusId: 'ws-in-progress', _count: 3 },
      { assigneeId: 'user-1', workflowStatusId: 'ws-backlog', _count: 2 },
      { assigneeId: 'user-2', workflowStatusId: 'ws-done', _count: 7 },
      { assigneeId: 'user-2', workflowStatusId: 'ws-in-progress', _count: 1 },
    ]);

    // Mock time logs grouped by userId
    mockPrismaService.timeLog.groupBy.mockResolvedValue([
      { userId: 'user-1', _sum: { minutes: 4800 } },  // 80 hours
      { userId: 'user-2', _sum: { minutes: 2700 } },  // 45 hours
    ]);

    // Mock bugs grouped by assigneeId
    mockPrismaService.bug.groupBy.mockResolvedValue([
      { assigneeId: 'user-1', _count: 2 },
      { assigneeId: 'user-2', _count: 5 },
    ]);

    const result = await service.getMemberPerformance(projectId);

    expect(result.members).toHaveLength(2);

    // User-1: 10 completed, 3 in-progress, 2 todo, 80h, 8h/task avg, 2 bugs
    const user1 = result.members.find((m) => m.userId === 'user-1')!;
    expect(user1.name).toBe('John Doe');
    expect(user1.tasks.completed).toBe(10);
    expect(user1.tasks.inProgress).toBe(3);
    expect(user1.tasks.todo).toBe(2);
    expect(user1.hoursLogged).toBe(80);
    expect(user1.avgHoursPerTask).toBe(8);
    expect(user1.bugCount).toBe(2);
    expect(user1.qualityRatio).toBeCloseTo(0.2);

    // User-2: 7 completed, 1 in-progress, 0 todo, 45h, ~6.43h/task avg, 5 bugs
    const user2 = result.members.find((m) => m.userId === 'user-2')!;
    expect(user2.tasks.completed).toBe(7);
    expect(user2.tasks.inProgress).toBe(1);
    expect(user2.tasks.todo).toBe(0);
    expect(user2.hoursLogged).toBe(45);
    expect(user2.avgHoursPerTask).toBeCloseTo(6.43, 1);
    expect(user2.bugCount).toBe(5);

    // Team avg = (80/10 + 45/7) / 2 or total hours / total completed
    // Total: 125h / 17 completed = ~7.35
    expect(result.teamAvgHoursPerTask).toBeCloseTo(7.35, 1);

    // Default sort: by completed count descending
    expect(result.members[0].userId).toBe('user-1');
    expect(result.members[1].userId).toBe('user-2');
  });

  it('handles members with zero completed tasks', async () => {
    const projectId = 'proj-1';

    mockPrismaService.projectMember.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        user: { id: 'user-1', name: 'New Dev', imageUrl: null },
      },
    ]);

    mockPrismaService.workflowStatus.findMany.mockResolvedValue([
      { id: 'ws-backlog', isClosed: false },
      { id: 'ws-done', isClosed: true },
    ]);

    mockPrismaService.task.groupBy.mockResolvedValue([
      { assigneeId: 'user-1', workflowStatusId: 'ws-backlog', _count: 5 },
    ]);

    mockPrismaService.timeLog.groupBy.mockResolvedValue([]);
    mockPrismaService.bug.groupBy.mockResolvedValue([]);

    const result = await service.getMemberPerformance(projectId);

    const user = result.members[0];
    expect(user.tasks.completed).toBe(0);
    expect(user.tasks.todo).toBe(5);
    expect(user.hoursLogged).toBe(0);
    expect(user.avgHoursPerTask).toBe(0);
    expect(user.bugCount).toBe(0);
    expect(user.qualityRatio).toBe(0);
    expect(result.teamAvgHoursPerTask).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/dashboard/dashboard.service.spec.ts --reporter=verbose`
Expected: FAIL — `service.getMemberPerformance is not a function`

- [ ] **Step 3: Implement getMemberPerformance in DashboardService**

Add this method to the `DashboardService` class in `apps/api/src/dashboard/dashboard.service.ts`, after the existing `getProjectDashboard` method (before the closing `}`):

```typescript
async getMemberPerformance(projectId: string, timeFilter?: 'sprint' | '7d' | '30d') {
  // Build date filter
  let dateFilter: { gte: Date } | undefined;
  let sprintFilter: { sprintId: string } | undefined;

  if (timeFilter === '7d') {
    dateFilter = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  } else if (timeFilter === '30d') {
    dateFilter = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  } else if (timeFilter === 'sprint') {
    const activeSprint = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (activeSprint) {
      sprintFilter = { sprintId: activeSprint.id };
    }
  }

  const taskWhere: Record<string, unknown> = { projectId, assigneeId: { not: null } };
  if (dateFilter) taskWhere.updatedAt = dateFilter;
  if (sprintFilter) taskWhere.sprintId = sprintFilter.sprintId;

  const timeLogWhere: Record<string, unknown> = { task: { projectId } };
  if (dateFilter) timeLogWhere.loggedAt = dateFilter;
  if (sprintFilter) timeLogWhere.task = { projectId, sprintId: sprintFilter.sprintId };

  const bugWhere: Record<string, unknown> = { projectId, assigneeId: { not: null } };
  if (dateFilter) bugWhere.createdAt = dateFilter;

  const [members, workflowStatuses, taskGroups, timeGroups, bugGroups] = await Promise.all([
    this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        userId: true,
        user: { select: { id: true, name: true, imageUrl: true } },
      },
    }),
    this.prisma.workflowStatus.findMany({
      where: { projectId, kind: 'TASK' },
      select: { id: true, isClosed: true },
    }),
    this.prisma.task.groupBy({
      by: ['assigneeId', 'workflowStatusId'],
      where: taskWhere,
      _count: true,
    }),
    this.prisma.timeLog.groupBy({
      by: ['userId'],
      where: timeLogWhere,
      _sum: { minutes: true },
    }),
    this.prisma.bug.groupBy({
      by: ['assigneeId'],
      where: bugWhere,
      _count: true,
    }),
  ]);

  const closedStatusIds = new Set(workflowStatuses.filter((ws) => ws.isClosed).map((ws) => ws.id));

  // Build lookup maps
  const timeByUser = new Map(timeGroups.map((t) => [t.userId, t._sum.minutes ?? 0]));
  const bugsByUser = new Map(bugGroups.map((b) => [b.assigneeId, b._count]));

  // Aggregate tasks per member
  const tasksByUser = new Map<string, { completed: number; inProgress: number; todo: number }>();
  for (const group of taskGroups) {
    if (!group.assigneeId) continue;
    const entry = tasksByUser.get(group.assigneeId) ?? { completed: 0, inProgress: 0, todo: 0 };
    if (group.workflowStatusId && closedStatusIds.has(group.workflowStatusId)) {
      entry.completed += group._count;
    } else if (group.workflowStatusId) {
      entry.inProgress += group._count;
    } else {
      entry.todo += group._count;
    }
    tasksByUser.set(group.assigneeId, entry);
  }

  let totalCompleted = 0;
  let totalHours = 0;

  const rows = members.map((member) => {
    const tasks = tasksByUser.get(member.userId) ?? { completed: 0, inProgress: 0, todo: 0 };
    const minutes = timeByUser.get(member.userId) ?? 0;
    const hoursLogged = Math.round((minutes / 60) * 100) / 100;
    const bugCount = bugsByUser.get(member.userId) ?? 0;
    const avgHoursPerTask = tasks.completed > 0 ? Math.round((hoursLogged / tasks.completed) * 100) / 100 : 0;
    const qualityRatio = tasks.completed > 0 ? Math.round((bugCount / tasks.completed) * 100) / 100 : 0;

    totalCompleted += tasks.completed;
    totalHours += hoursLogged;

    return {
      userId: member.userId,
      name: member.user.name ?? member.user.id,
      imageUrl: member.user.imageUrl,
      tasks: { ...tasks, total: tasks.completed + tasks.inProgress + tasks.todo },
      hoursLogged,
      avgHoursPerTask,
      bugCount,
      qualityRatio,
    };
  });

  // Sort by completed count descending
  rows.sort((a, b) => b.tasks.completed - a.tasks.completed);

  const teamAvgHoursPerTask = totalCompleted > 0
    ? Math.round((totalHours / totalCompleted) * 100) / 100
    : 0;

  return { members: rows, teamAvgHoursPerTask };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/dashboard/dashboard.service.spec.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/dashboard.service.ts apps/api/src/dashboard/dashboard.service.spec.ts
git commit -m "feat: add getMemberPerformance method to DashboardService"
```

---

### Task 2: Backend — Integrate into getProjectDashboard and controller

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.service.ts:14-224` (the `getProjectDashboard` method)
- Modify: `apps/api/src/dashboard/dashboard.controller.ts:1-16`

- [ ] **Step 1: Update getProjectDashboard to include memberPerformance**

In `apps/api/src/dashboard/dashboard.service.ts`, modify the `getProjectDashboard` method. Replace the recentActivity logic and add memberPerformance call.

Remove lines 134-156 (the `recentActivity` building block — `taskActivity`, `bugActivity`, `recentActivity` merge). Also remove `recentTasks` and `recentBugs` from the `Promise.all` at lines 38-59.

Then, after the `bugCountData` block (line 215), add:

```typescript
const memberPerformance = await this.getMemberPerformance(projectId);
```

Update the return statement (line 217-223) to:

```typescript
return {
  taskCounts,
  activeSprint: activeSprintData,
  burndown,
  bugCounts: bugCountData,
  memberPerformance: memberPerformance.members,
  teamAvgHoursPerTask: memberPerformance.teamAvgHoursPerTask,
};
```

- [ ] **Step 2: Add optional timeFilter query param to controller**

In `apps/api/src/dashboard/dashboard.controller.ts`, update the controller to accept a query param:

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('projects/:projectId/dashboard')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getProjectDashboard(
    @Param('projectId') projectId: string,
    @Query('timeFilter') timeFilter?: 'sprint' | '7d' | '30d',
  ) {
    return this.dashboardService.getProjectDashboard(projectId, timeFilter);
  }
}
```

Then update `getProjectDashboard` signature to accept the `timeFilter` and pass it to `getMemberPerformance`:

```typescript
async getProjectDashboard(projectId: string, timeFilter?: 'sprint' | '7d' | '30d') {
  // ... existing code ...
  const memberPerformance = await this.getMemberPerformance(projectId, timeFilter);
  // ...
}
```

- [ ] **Step 3: Update existing tests to match new response shape**

In `apps/api/src/dashboard/dashboard.service.spec.ts`, the existing tests for `getProjectDashboard()` need mock updates:

Add to `mockPrismaService` (if not already added in Task 1):
```typescript
projectMember: { findMany: vi.fn().mockResolvedValue([]) },
timeLog: { groupBy: vi.fn().mockResolvedValue([]) },
```

And update `bug` to include `groupBy`:
```typescript
bug: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
```

In the existing `setupWorkflowStatusMocks()` function, add a third mock call for the `getMemberPerformance` workflow status query:
```typescript
function setupWorkflowStatusMocks() {
  mockPrismaService.workflowStatus.findMany
    .mockResolvedValueOnce(mockWorkflowStatuses) // first call: all project statuses
    .mockResolvedValueOnce(mockBugWorkflowStatuses) // second call: BUG kind statuses
    .mockResolvedValueOnce(mockWorkflowStatuses); // third call: member performance TASK statuses
}
```

Remove assertions on `recentActivity` from existing tests. The response now includes `memberPerformance` and `teamAvgHoursPerTask` instead.

Also remove `recentTasks` and `recentBugs` mock setups — the two `task.findMany` and `bug.findMany` calls for recent items no longer happen. Keep only the `task.findMany` for burndown (sprint-related tests) and `bug.findMany` if still needed.

- [ ] **Step 4: Run all tests**

Run: `cd apps/api && npx vitest run src/dashboard/dashboard.service.spec.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/dashboard.service.ts apps/api/src/dashboard/dashboard.controller.ts apps/api/src/dashboard/dashboard.service.spec.ts
git commit -m "feat: integrate memberPerformance into dashboard endpoint, remove recentActivity"
```

---

### Task 3: Frontend — Add types and update API client

**Files:**
- Modify: `apps/web/src/lib/types.ts:372-425`

- [ ] **Step 1: Add MemberPerformanceRow type and update DashboardData**

In `apps/web/src/lib/types.ts`, add the new type after the `BugCounts` interface (after line 417), and update `DashboardData`:

```typescript
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
```

Update `DashboardData` (line 419-425) — replace `recentActivity: ActivityItem[];` with `memberPerformance` fields:

```typescript
export interface DashboardData {
  taskCounts: TaskCounts;
  activeSprint: ActiveSprintData | null;
  burndown: BurndownPoint[];
  bugCounts: BugCounts;
  memberPerformance: MemberPerformanceRow[];
  teamAvgHoursPerTask: number;
}
```

The `ActivityItem` interface (lines 395-401) can stay — other code might use it — but remove it if nothing else imports it.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add MemberPerformanceRow type, update DashboardData"
```

---

### Task 4: Frontend — Create MemberPerformance component

**Files:**
- Create: `apps/web/src/components/dashboard/MemberPerformance.tsx`

- [ ] **Step 1: Create the MemberPerformance component**

Create `apps/web/src/components/dashboard/MemberPerformance.tsx`:

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MemberPerformanceRow } from '@/lib/types';

interface MemberPerformanceProps {
  members: MemberPerformanceRow[];
  teamAvgHoursPerTask: number;
  timeFilter: string;
  onTimeFilterChange: (value: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function QualityBlocks({ ratio }: { ratio: number }) {
  let filled: number;
  let color: string;

  if (ratio === 0) {
    filled = 5;
    color = '#22c55e';
  } else if (ratio < 0.1) {
    filled = 4;
    color = '#22c55e';
  } else if (ratio < 0.25) {
    filled = 3;
    color = '#22c55e';
  } else if (ratio < 0.5) {
    filled = 2;
    color = '#f59e0b';
  } else {
    filled = 1;
    color = '#ef4444';
  }

  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-6 w-2 rounded-sm"
          style={{ backgroundColor: i < filled ? color : 'hsl(var(--muted))' }}
        />
      ))}
    </div>
  );
}

function TaskBar({ completed, inProgress, todo }: { completed: number; inProgress: number; todo: number }) {
  const total = completed + inProgress + todo;
  if (total === 0) {
    return <div className="h-5 w-full rounded bg-muted" />;
  }

  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded" style={{ gap: '1px' }}>
        {completed > 0 && (
          <div
            style={{ width: `${(completed / total) * 100}%`, backgroundColor: '#22c55e' }}
            title={`Done: ${completed}`}
          />
        )}
        {inProgress > 0 && (
          <div
            style={{ width: `${(inProgress / total) * 100}%`, backgroundColor: '#3b82f6' }}
            title={`In Progress: ${inProgress}`}
          />
        )}
        {todo > 0 && (
          <div
            style={{ width: `${(todo / total) * 100}%`, backgroundColor: 'hsl(var(--muted-foreground) / 0.3)' }}
            title={`To Do: ${todo}`}
          />
        )}
      </div>
      <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
        <span><span className="text-green-500">●</span> {completed} done</span>
        <span><span className="text-blue-500">●</span> {inProgress} active</span>
        <span><span className="text-muted-foreground">●</span> {todo} todo</span>
      </div>
    </div>
  );
}

function TrendArrow({ avgHours, teamAvg }: { avgHours: number; teamAvg: number }) {
  if (avgHours === 0 || teamAvg === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Lower avg hours per task = more efficient = green up arrow
  const isBetter = avgHours <= teamAvg;

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium">{avgHours.toFixed(1)}h</span>
      <svg width="12" height="12" viewBox="0 0 12 12">
        {isBetter ? (
          <path d="M6 2 L10 8 L2 8 Z" fill="#22c55e" />
        ) : (
          <path d="M6 10 L10 4 L2 4 Z" fill="#ef4444" />
        )}
      </svg>
    </div>
  );
}

const AVATAR_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#f97316', '#8b5cf6'];

export function MemberPerformance({ members, teamAvgHoursPerTask, timeFilter, onTimeFilterChange }: MemberPerformanceProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Performance</CardTitle>
        <Select value={timeFilter} onValueChange={onTimeFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="sprint">This sprint</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members in this project.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Member</th>
                  <th className="pb-3 font-medium">Task Breakdown</th>
                  <th className="pb-3 font-medium">Hours</th>
                  <th className="pb-3 font-medium">Avg Time/Task</th>
                  <th className="pb-3 font-medium">Quality</th>
                  <th className="pb-3 font-medium">Bugs</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr key={member.userId} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {member.imageUrl ? (
                          <img
                            src={member.imageUrl}
                            alt={member.name}
                            className="size-7 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                            style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                          >
                            {getInitials(member.name)}
                          </div>
                        )}
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="min-w-[180px] py-3 pr-4">
                      <TaskBar
                        completed={member.tasks.completed}
                        inProgress={member.tasks.inProgress}
                        todo={member.tasks.todo}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold">{Math.round(member.hoursLogged)}</span>
                        <span className="text-muted-foreground">h</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <TrendArrow avgHours={member.avgHoursPerTask} teamAvg={teamAvgHoursPerTask} />
                    </td>
                    <td className="py-3 pr-4">
                      {member.tasks.completed === 0 ? (
                        <div className="flex gap-[3px]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-6 w-2 rounded-sm bg-muted" />
                          ))}
                        </div>
                      ) : (
                        <QualityBlocks ratio={member.qualityRatio} />
                      )}
                    </td>
                    <td className="py-3">
                      <span className="text-sm font-medium">{member.bugCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/MemberPerformance.tsx
git commit -m "feat: create MemberPerformance dashboard component"
```

---

### Task 5: Frontend — Wire up the dashboard page

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage.tsx:1-101`
- Modify: `apps/web/src/hooks/useDashboard.ts:1-11`
- Delete: `apps/web/src/components/dashboard/RecentActivity.tsx`

- [ ] **Step 1: Update useDashboard hook to accept timeFilter**

Replace the contents of `apps/web/src/hooks/useDashboard.ts` with:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboard(projectId: string, timeFilter?: string) {
  const params = timeFilter && timeFilter !== 'all' ? `?timeFilter=${timeFilter}` : '';
  return useQuery({
    queryKey: ['dashboard', projectId, timeFilter],
    queryFn: () => api.getDashboard(projectId, params),
    enabled: !!projectId,
  });
}
```

Then update the `api.getDashboard` call in `apps/web/src/lib/api.ts` to accept the query string. Find the line (around 290):

```typescript
getDashboard: (projectId: string) =>
  request<DashboardData>(`/projects/${projectId}/dashboard`),
```

Replace with:

```typescript
getDashboard: (projectId: string, params = '') =>
  request<DashboardData>(`/projects/${projectId}/dashboard${params}`),
```

- [ ] **Step 2: Update ProjectDashboardPage to use MemberPerformance**

Replace the contents of `apps/web/src/pages/ProjectDashboardPage.tsx` with:

```tsx
import { useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardStatusStrip } from '@/components/dashboard/DashboardStatusStrip';
import { BurndownChart } from '@/components/dashboard/BurndownChart';
import { MemberPerformance } from '@/components/dashboard/MemberPerformance';
import { BugSummaryBanner } from '@/components/dashboard/BugSummaryBanner';
import { useDashboard } from '@/hooks/useDashboard';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: scrollable stat cards */}
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[96px] min-w-[160px] rounded-xl shrink-0" />
        ))}
      </div>
      {/* Row 2: burndown + sprint */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
      </div>
      {/* Row 3: bug banner */}
      <Skeleton className="h-[60px] rounded-xl" />
      {/* Row 4: member performance */}
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export function ProjectDashboardPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const [timeFilter, setTimeFilter] = useState('all');
  const { data, isLoading } = useDashboard(projectId, timeFilter);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-8 py-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  const taskCounts = data?.taskCounts ?? { total: 0, byStatus: [], orphaned: 0 };
  const activeSprint = data?.activeSprint ?? null;
  const burndownData = data?.burndown ?? [];
  const bugCounts = data?.bugCounts ?? { total: 0, open: 0, critical: 0 };
  const memberPerformance = data?.memberPerformance ?? [];
  const teamAvgHoursPerTask = data?.teamAvgHoursPerTask ?? 0;

  const sprintProgress =
    activeSprint && activeSprint.totalPoints > 0
      ? Math.round((activeSprint.completedPoints / activeSprint.totalPoints) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Row 1: Dynamic status cards with horizontal scroll */}
      <DashboardStatusStrip total={taskCounts.total} byStatus={taskCounts.byStatus} />

      {/* Row 2: Burndown (60%) + Sprint progress (40%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Burndown Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <BurndownChart data={burndownData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Sprint</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSprint ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium">{activeSprint.name}</p>
                <Progress value={sprintProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {activeSprint.completedPoints} / {activeSprint.totalPoints} points completed
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active sprint</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Bug summary banner */}
      <BugSummaryBanner bugCounts={bugCounts} />

      {/* Row 4: Member performance table */}
      <MemberPerformance
        members={memberPerformance}
        teamAvgHoursPerTask={teamAvgHoursPerTask}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
      />
    </div>
  );
}
```

- [ ] **Step 3: Delete RecentActivity.tsx**

```bash
rm apps/web/src/components/dashboard/RecentActivity.tsx
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ProjectDashboardPage.tsx apps/web/src/hooks/useDashboard.ts apps/web/src/lib/api.ts apps/web/src/lib/types.ts
git rm apps/web/src/components/dashboard/RecentActivity.tsx
git commit -m "feat: replace RecentActivity with MemberPerformance on dashboard"
```

---

### Task 6: Cleanup — Remove unused ActivityItem type if no other importers

**Files:**
- Modify: `apps/web/src/lib/types.ts` (potentially)

- [ ] **Step 1: Check if ActivityItem is imported anywhere else**

Run: `grep -r "ActivityItem" apps/web/src/ --include="*.ts" --include="*.tsx" -l`

If only `types.ts` references it, remove the `ActivityItem` interface from `types.ts`.

- [ ] **Step 2: Commit if changes were made**

```bash
git add apps/web/src/lib/types.ts
git commit -m "chore: remove unused ActivityItem type"
```
