# Dynamic Dashboard Status Cards & My Tasks Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard status cards render dynamically from workflow config with horizontal scroll, add `isWorking` flag to WorkflowStatus, and replace the My Tasks kanban board with a filterable/sortable table.

**Architecture:** Three changes: (1) Prisma schema migration adding `isWorking` boolean to `WorkflowStatus` with backend validation and workflow editor UI, (2) new `DashboardStatusStrip` component replacing the hardcoded 4-card grid, (3) new `MyTasksTable` component replacing `MyTasksBoard` with sortable columns and multi-select filters.

**Tech Stack:** Prisma (migration), NestJS (validation), React, Tailwind CSS, shadcn/ui (Table, Badge, Select), Lucide icons

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/api/prisma/schema.prisma` | Add `isWorking` to `WorkflowStatus` |
| Modify | `apps/api/src/workflow/dto/save-workflow.dto.ts` | Add `isWorking` to `WorkflowStatusDto` |
| Modify | `apps/api/src/workflow/workflow.service.ts` | Validate `isWorking` mutual exclusivity, update seed defaults |
| Modify | `apps/web/src/lib/types.ts` | Add `isWorking` to `WorkflowStatus` and `SaveWorkflowPayload` |
| Modify | `apps/web/src/components/workflow/StatusNode.tsx` | Show "Working" badge on nodes |
| Modify | `apps/web/src/components/workflow/WorkflowEditor.tsx` | Add "Is Working" toggle in edit dialog |
| Create | `apps/web/src/components/dashboard/DashboardStatusStrip.tsx` | Scrollable card strip |
| Modify | `apps/web/src/components/dashboard/StatCard.tsx` | Add `accentColor` prop |
| Modify | `apps/web/src/pages/ProjectDashboardPage.tsx` | Use `DashboardStatusStrip`, update skeleton |
| Create | `apps/web/src/components/tasks/MyTasksTable.tsx` | Filterable/sortable table |
| Modify | `apps/web/src/pages/MyTasksPage.tsx` | Use `MyTasksTable` instead of `MyTasksBoard` |
| Delete | `apps/web/src/components/tasks/MyTasksBoard.tsx` | Replaced by `MyTasksTable` |

---

### Task 1: Add `isWorking` to Prisma Schema and Generate Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma:53-73`

- [ ] **Step 1: Add `isWorking` field to WorkflowStatus model**

In `apps/api/prisma/schema.prisma`, add `isWorking` after line 61 (`isClosed`):

```prisma
model WorkflowStatus {
  id        String   @id @default(cuid())
  projectId String
  name      String
  key       String
  color     String
  position  Int
  isDefault      Boolean  @default(false)
  isClosed       Boolean  @default(false)
  isWorking      Boolean  @default(false)
  autoDateField  String?
  autoDateAction String?
  createdAt      DateTime @default(now())

  project         Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  transitionsFrom WorkflowTransition[] @relation("TransitionFrom")
  transitionsTo   WorkflowTransition[] @relation("TransitionTo")
  assigneeRules   StatusAssigneeRule[]
  tasks           Task[]               @relation("TaskWorkflowStatus")

  @@unique([projectId, key])
}
```

- [ ] **Step 2: Generate and run migration**

```bash
cd apps/api && npx prisma migrate dev --name add-is-working-to-workflow-status
```

Expected: Migration created and applied. New `isWorking` column with default `false`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add isWorking field to WorkflowStatus schema"
```

---

### Task 2: Backend — Update DTO and Validation for `isWorking`

**Files:**
- Modify: `apps/api/src/workflow/dto/save-workflow.dto.ts:16-51`
- Modify: `apps/api/src/workflow/workflow.service.ts:5-11,87-176,217-238`

- [ ] **Step 1: Add `isWorking` to `WorkflowStatusDto`**

In `apps/api/src/workflow/dto/save-workflow.dto.ts`, add after the `isClosed` field (line 42):

```typescript
export class WorkflowStatusDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'key must be uppercase with underscores' })
  key: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #ff0000' })
  color: string;

  @IsInt()
  @Min(0)
  position: number;

  @IsBoolean()
  isDefault: boolean;

  @IsBoolean()
  isClosed: boolean;

  @IsBoolean()
  isWorking: boolean;

  @IsOptional()
  @IsIn(['actualStartDate', 'actualEndDate', 'plannedStartDate', 'plannedEndDate', null])
  autoDateField?: string | null;

  @IsOptional()
  @IsIn(['set', 'clear', null])
  autoDateAction?: string | null;
}
```

- [ ] **Step 2: Add validation in `saveWorkflow` for mutual exclusivity**

In `apps/api/src/workflow/workflow.service.ts`, add after the duplicate key check (after line 101):

```typescript
    // Validate isWorking mutual exclusivity
    for (const s of dto.statuses) {
      if (s.isWorking && s.isDefault) {
        throw new BadRequestException(
          `Status "${s.name}": isWorking cannot be combined with isDefault`,
        );
      }
      if (s.isWorking && s.isClosed) {
        throw new BadRequestException(
          `Status "${s.name}": isWorking cannot be combined with isClosed`,
        );
      }
    }
```

- [ ] **Step 3: Add `isWorking` to the status create data in `saveWorkflow`**

In the `saveWorkflow` transaction (around line 163-174), add `isWorking` to the create data:

```typescript
        const created = await tx.workflowStatus.create({
          data: {
            projectId,
            name: s.name,
            key: s.key,
            color: s.color,
            position: s.position,
            isDefault: s.isDefault,
            isClosed: s.isClosed,
            isWorking: s.isWorking,
            autoDateField: s.autoDateField ?? null,
            autoDateAction: s.autoDateAction ?? null,
          },
        });
```

- [ ] **Step 4: Update `DEFAULT_STATUSES` seed to include `isWorking`**

Update the default statuses array at the top of `workflow.service.ts`:

```typescript
const DEFAULT_STATUSES = [
  { key: 'BACKLOG', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true, isClosed: false, isWorking: false },
  { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', position: 1, isDefault: false, isClosed: false, isWorking: true },
  { key: 'IN_REVIEW', name: 'In Review', color: '#f59e0b', position: 2, isDefault: false, isClosed: false, isWorking: true },
  { key: 'DONE', name: 'Done', color: '#22c55e', position: 3, isDefault: false, isClosed: true, isWorking: false },
  { key: 'BLOCKED', name: 'Blocked', color: '#ef4444', position: 4, isDefault: false, isClosed: false, isWorking: false },
];
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workflow/
git commit -m "feat: add isWorking validation and DTO support"
```

---

### Task 3: Frontend Types — Add `isWorking` to TypeScript Interfaces

**Files:**
- Modify: `apps/web/src/lib/types.ts:6-17,41-62`

- [ ] **Step 1: Add `isWorking` to `WorkflowStatus` interface**

In `apps/web/src/lib/types.ts`, update the `WorkflowStatus` interface (line 6-17):

```typescript
export interface WorkflowStatus {
  id: string;
  projectId: string;
  name: string;
  key: string;
  color: string;
  position: number;
  isDefault: boolean;
  isClosed: boolean;
  isWorking: boolean;
  autoDateField: AutoDateField | null;
  autoDateAction: AutoDateAction | null;
}
```

- [ ] **Step 2: Add `isWorking` to `SaveWorkflowPayload` status shape**

In the same file, update `SaveWorkflowPayload` (line 41-62):

```typescript
export interface SaveWorkflowPayload {
  statuses: {
    id?: string;
    name: string;
    key: string;
    color: string;
    position: number;
    isDefault: boolean;
    isClosed: boolean;
    isWorking: boolean;
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add isWorking to frontend WorkflowStatus types"
```

---

### Task 4: Workflow Editor — Add `isWorking` Toggle and StatusNode Badge

**Files:**
- Modify: `apps/web/src/components/workflow/StatusNode.tsx:7-17,19-20,31-41`
- Modify: `apps/web/src/components/workflow/WorkflowEditor.tsx:49-67,79-88,119-128,197-213,250-262`

- [ ] **Step 1: Add `isWorking` to `StatusNodeData` and render badge**

Replace the full content of `apps/web/src/components/workflow/StatusNode.tsx`:

```typescript
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export interface StatusNodeData {
  name: string;
  color: string;
  key: string;
  isDefault: boolean;
  isClosed: boolean;
  isWorking: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  [key: string]: unknown;
}

function StatusNodeComponent({ id, data }: NodeProps) {
  const { name, color, isDefault, isClosed, isWorking, onEdit, onDelete, canManage } = data as unknown as StatusNodeData;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <div
        className="rounded-lg border bg-card shadow-sm min-w-[140px] overflow-hidden"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="px-3 py-2 flex flex-col gap-1">
          <span className="text-sm font-semibold">{name}</span>
          <div className="flex items-center gap-1">
            {isDefault && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                Default
              </Badge>
            )}
            {isClosed && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                Closed
              </Badge>
            )}
            {isWorking && (
              <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-500/15 text-blue-600 border-transparent">
                Working
              </Badge>
            )}
          </div>
        </div>
        {canManage && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="size-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); onEdit(id); }}
            >
              <Pencil className="size-3" />
            </Button>
            {!isDefault && !isClosed && (
              <Button
                variant="destructive"
                size="icon"
                className="size-6 rounded-full shadow-md"
                onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
}

export const StatusNode = memo(StatusNodeComponent);
```

- [ ] **Step 2: Update `WorkflowEditor` — add `isWorking` to form data, dialog, and save**

In `apps/web/src/components/workflow/WorkflowEditor.tsx`, make these changes:

**2a.** Add `isWorking` to `StatusFormData` interface and `EMPTY_FORM` (lines 49-67):

```typescript
interface StatusFormData {
  name: string;
  key: string;
  color: string;
  isDefault: boolean;
  isClosed: boolean;
  isWorking: boolean;
  autoDateField: AutoDateField | null;
  autoDateAction: AutoDateAction | null;
}

const EMPTY_FORM: StatusFormData = {
  name: '',
  key: '',
  color: '#6b7280',
  isDefault: false,
  isClosed: false,
  isWorking: false,
  autoDateField: null,
  autoDateAction: null,
};
```

**2b.** Add `isWorking` to `statusToNode` (lines 69-90) — add to data object:

```typescript
function statusToNode(
  status: WorkflowStatus,
  position: { x: number; y: number },
  callbacks: { onEdit: (id: string) => void; onDelete: (id: string) => void },
  canManage: boolean,
): Node {
  return {
    id: status.id ?? status.key,
    type: 'statusNode',
    position,
    data: {
      name: status.name,
      color: status.color,
      key: status.key,
      isDefault: status.isDefault,
      isClosed: status.isClosed,
      isWorking: status.isWorking,
      onEdit: callbacks.onEdit,
      onDelete: callbacks.onDelete,
      canManage,
    } satisfies StatusNodeData,
  };
}
```

**2c.** Add `isWorking` to `handleEdit` form data population (around line 120-128):

```typescript
      setFormData({
        name: d.name,
        key: d.key,
        color: d.color,
        isDefault: d.isDefault,
        isClosed: d.isClosed,
        isWorking: d.isWorking ?? false,
        autoDateField: (d.autoDateField as AutoDateField) ?? null,
        autoDateAction: (d.autoDateAction as AutoDateAction) ?? null,
      });
```

**2d.** Add `isWorking` to the `handleSave` statuses serialization (around line 251-263):

```typescript
    const statuses = nodes.map((n, i) => {
      const d = n.data as unknown as StatusNodeData;
      return {
        name: d.name,
        key: d.key,
        color: d.color,
        position: i,
        isDefault: d.isDefault,
        isClosed: d.isClosed,
        isWorking: d.isWorking,
        autoDateField: (d.autoDateField as AutoDateField) ?? null,
        autoDateAction: (d.autoDateAction as AutoDateAction) ?? null,
      };
    });
```

**2e.** Add "Is Working" toggle in the edit dialog, after the "Closed" switch (after line 409). Also disable it when `isDefault` or `isClosed` is checked:

```typescript
            <div className="flex items-center justify-between">
              <div>
                <Label>Is Working</Label>
                <p className="text-xs text-muted-foreground">Tasks in this status are actively being worked on</p>
              </div>
              <Switch
                checked={formData.isWorking}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isWorking: v }))}
                disabled={formData.isDefault || formData.isClosed}
              />
            </div>
```

**2f.** Update the `isDefault` and `isClosed` switch handlers to clear `isWorking` when toggled on:

For `isDefault` switch (line 399-401):
```typescript
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isDefault: v, isWorking: v ? false : f.isWorking }))}
              />
```

For `isClosed` switch (line 405-407):
```typescript
              <Switch
                checked={formData.isClosed}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isClosed: v, isWorking: v ? false : f.isWorking }))}
              />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workflow/
git commit -m "feat: add isWorking toggle to workflow editor and status node"
```

---

### Task 5: Dashboard — Create `DashboardStatusStrip` with Horizontal Scroll

**Files:**
- Modify: `apps/web/src/components/dashboard/StatCard.tsx`
- Create: `apps/web/src/components/dashboard/DashboardStatusStrip.tsx`
- Modify: `apps/web/src/pages/ProjectDashboardPage.tsx`

- [ ] **Step 1: Update `StatCard` to support `accentColor` prop**

Replace the full content of `apps/web/src/components/dashboard/StatCard.tsx`:

```typescript
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger';
  accentColor?: string;
}

export function StatCard({ title, value, icon: Icon, variant = 'default', accentColor }: StatCardProps) {
  return (
    <Card className="min-w-[160px]" style={accentColor ? { borderTopColor: accentColor, borderTopWidth: 3 } : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-semibold tracking-[0.01em]">
            {title}
          </CardTitle>
          <Icon
            className={cn(
              'size-4',
              !accentColor && variant === 'default' && 'text-muted-foreground',
              variant === 'danger' && 'text-[var(--status-blocked)]',
              variant === 'warning' && 'text-[var(--status-in-review)]',
            )}
            style={accentColor ? { color: accentColor } : undefined}
          />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <span
          className={cn(
            'text-[28px] font-semibold leading-[1.2] tracking-[-0.03em]',
            variant === 'danger' && 'text-[var(--status-blocked)]',
            variant === 'warning' && 'text-[var(--status-in-review)]',
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `DashboardStatusStrip` component**

Create `apps/web/src/components/dashboard/DashboardStatusStrip.tsx`:

```typescript
import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ListTodo, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from './StatCard';
import type { StatusCount } from '@/lib/types';

interface DashboardStatusStripProps {
  total: number;
  byStatus: StatusCount[];
}

export function DashboardStatusStrip({ total, byStatus }: DashboardStatusStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group/strip">
      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="shrink-0">
          <StatCard title="Total Tasks" value={total} icon={ListTodo} />
        </div>
        {byStatus.map((s) => (
          <div key={s.statusId} className="shrink-0">
            <StatCard
              title={s.name}
              value={s.count}
              icon={Circle}
              accentColor={s.color}
            />
          </div>
        ))}
      </div>

      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `ProjectDashboardPage` to use `DashboardStatusStrip`**

Replace the full content of `apps/web/src/pages/ProjectDashboardPage.tsx`:

```typescript
import { useUiStore } from '@/store/uiStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardStatusStrip } from '@/components/dashboard/DashboardStatusStrip';
import { BurndownChart } from '@/components/dashboard/BurndownChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
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
      {/* Row 3: activity */}
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export function ProjectDashboardPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data, isLoading } = useDashboard(projectId);

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
  const activities = data?.recentActivity ?? [];

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

      {/* Row 3: Recent activity */}
      <RecentActivity activities={activities} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/ apps/web/src/pages/ProjectDashboardPage.tsx
git commit -m "feat: dynamic dashboard status cards with horizontal scroll"
```

---

### Task 6: My Tasks — Create Filterable/Sortable Table

**Files:**
- Create: `apps/web/src/components/tasks/MyTasksTable.tsx`
- Modify: `apps/web/src/pages/MyTasksPage.tsx`
- Delete: `apps/web/src/components/tasks/MyTasksBoard.tsx`

- [ ] **Step 1: Create `MyTasksTable` component**

Create `apps/web/src/components/tasks/MyTasksTable.tsx`:

```typescript
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/time-utils';
import type { Task, Priority } from '@/lib/types';

// ─── Priority Config ───────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
  BLOCKER: 4,
};

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string }> = {
  LOW:      { color: '#6b7280', label: 'Low' },
  MEDIUM:   { color: '#3b82f6', label: 'Medium' },
  HIGH:     { color: '#f59e0b', label: 'High' },
  CRITICAL: { color: '#ef4444', label: 'Critical' },
  BLOCKER:  { color: '#7c3aed', label: 'Blocker' },
};

const ALL_PRIORITIES: Priority[] = ['BLOCKER', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

type SortField = 'taskKey' | 'title' | 'project' | 'status' | 'priority' | 'dueDate';
type SortDir = 'asc' | 'desc';

function isOverdue(plannedEndDate: string | null | undefined, isClosed: boolean): boolean {
  if (!plannedEndDate || isClosed) return false;
  return new Date(plannedEndDate) < new Date();
}

function compareTasks(a: Task, b: Task, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case 'taskKey':
      cmp = (a.taskKey ?? '').localeCompare(b.taskKey ?? '');
      break;
    case 'title':
      cmp = a.title.localeCompare(b.title);
      break;
    case 'project':
      cmp = (a.project?.name ?? '').localeCompare(b.project?.name ?? '');
      break;
    case 'status':
      cmp = (a.workflowStatus?.position ?? 0) - (b.workflowStatus?.position ?? 0);
      break;
    case 'priority': {
      const aPri = a.priority ? PRIORITY_ORDER[a.priority] : -1;
      const bPri = b.priority ? PRIORITY_ORDER[b.priority] : -1;
      cmp = aPri - bPri;
      break;
    }
    case 'dueDate': {
      const aDate = a.plannedEndDate ? new Date(a.plannedEndDate).getTime() : Infinity;
      const bDate = b.plannedEndDate ? new Date(b.plannedEndDate).getTime() : Infinity;
      cmp = aDate - bDate;
      break;
    }
  }
  return dir === 'desc' ? -cmp : cmp;
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  tasks: Task[];
  statusFilter: string[];
  priorityFilter: string[];
  projectFilter: string[];
  onStatusChange: (v: string[]) => void;
  onPriorityChange: (v: string[]) => void;
  onProjectChange: (v: string[]) => void;
  onClear: () => void;
}

function FilterBar({
  tasks,
  statusFilter,
  priorityFilter,
  projectFilter,
  onStatusChange,
  onPriorityChange,
  onProjectChange,
  onClear,
}: FilterBarProps) {
  const statuses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const t of tasks) {
      if (t.workflowStatus) {
        map.set(t.workflowStatus.id, {
          id: t.workflowStatus.id,
          name: t.workflowStatus.name,
          color: t.workflowStatus.color,
        });
      }
    }
    return Array.from(map.values());
  }, [tasks]);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const t of tasks) {
      if (t.project) {
        map.set(t.projectId, { id: t.projectId, name: t.project.name });
      }
    }
    return Array.from(map.values());
  }, [tasks]);

  const hasFilters = statusFilter.length > 0 || priorityFilter.length > 0 || projectFilter.length > 0;

  const toggleFilter = (current: string[], value: string, setter: (v: string[]) => void) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value="" onValueChange={(v) => toggleFilter(statusFilter, v, onStatusChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={statusFilter.length > 0 ? `Status (${statusFilter.length})` : 'Status'} />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                {statusFilter.includes(s.id) && <span className="ml-auto text-primary">✓</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value="" onValueChange={(v) => toggleFilter(priorityFilter, v, onPriorityChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={priorityFilter.length > 0 ? `Priority (${priorityFilter.length})` : 'Priority'} />
        </SelectTrigger>
        <SelectContent>
          {ALL_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: PRIORITY_CONFIG[p].color }} />
                {PRIORITY_CONFIG[p].label}
                {priorityFilter.includes(p) && <span className="ml-auto text-primary">✓</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value="" onValueChange={(v) => toggleFilter(projectFilter, v, onProjectChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={projectFilter.length > 0 ? `Project (${projectFilter.length})` : 'Project'} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                {p.name}
                {projectFilter.includes(p.id) && <span className="ml-auto text-primary">✓</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          <X className="size-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ─── Sortable Header ───────────────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors text-xs"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-[10px]">{currentDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </div>
    </TableHead>
  );
}

// ─── MyTasksTable ──────────────────────────────────────────────────────────────

interface MyTasksTableProps {
  tasks: Task[];
}

export function MyTasksTable({ tasks }: MyTasksTableProps) {
  const navigate = useNavigate();

  // Sort state — default: dueDate asc, then priority desc
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'priority' ? 'desc' : 'asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = tasks;

    if (statusFilter.length > 0) {
      result = result.filter((t) => t.workflowStatus && statusFilter.includes(t.workflowStatus.id));
    }
    if (priorityFilter.length > 0) {
      result = result.filter((t) => t.priority && priorityFilter.includes(t.priority));
    }
    if (projectFilter.length > 0) {
      result = result.filter((t) => projectFilter.includes(t.projectId));
    }

    return [...result].sort((a, b) => {
      const primary = compareTasks(a, b, sortField, sortDir);
      if (primary !== 0) return primary;
      // Secondary sort: if sorting by dueDate, break ties with priority desc. Otherwise break with dueDate asc.
      if (sortField === 'dueDate') {
        return compareTasks(a, b, 'priority', 'desc');
      }
      return compareTasks(a, b, 'dueDate', 'asc');
    });
  }, [tasks, statusFilter, priorityFilter, projectFilter, sortField, sortDir]);

  const handleClearFilters = () => {
    setStatusFilter([]);
    setPriorityFilter([]);
    setProjectFilter([]);
  };

  const handleRowClick = (task: Task) => {
    const prefix = task.project?.prefix ?? task.projectId;
    navigate(`/projects/${prefix}/tasks/${task.taskKey ?? task.id}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        tasks={tasks}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        projectFilter={projectFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onProjectChange={setProjectFilter}
        onClear={handleClearFilters}
      />

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Key" field="taskKey" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Title" field="title" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Project" field="project" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Priority" field="priority" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Due Date" field="dueDate" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <TableHead className="text-xs">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No tasks match the current filters
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((task) => {
                const isClosed = task.workflowStatus?.isClosed === true;
                const overdue = isOverdue(task.plannedEndDate, isClosed);
                const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
                const isWorkingStatus = task.workflowStatus?.isWorking === true;
                const logged = task.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;

                return (
                  <TableRow
                    key={task.id}
                    className={cn('cursor-pointer hover:bg-muted/50 transition-colors', isClosed && 'opacity-50')}
                    onClick={() => handleRowClick(task)}
                  >
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {task.taskKey}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <span className={cn('text-sm font-medium truncate block', isClosed && 'line-through')}>
                        {task.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      {task.project && (
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5">
                          {task.project.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isWorkingStatus && (
                          <span
                            className="size-2 rounded-full animate-pulse"
                            style={{ backgroundColor: task.workflowStatus?.color }}
                          />
                        )}
                        <StatusBadge status={task.workflowStatus ?? null} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {priority && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: priority.color, boxShadow: `0 0 4px ${priority.color}` }}
                          />
                          <span className="text-xs font-medium" style={{ color: priority.color }}>
                            {priority.label}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {task.plannedEndDate ? (
                        <div className={cn('flex items-center gap-1 text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                          <Calendar className="size-3" />
                          {format(new Date(task.plannedEndDate), 'MMM d, yyyy')}
                          {overdue && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 ml-1">
                              OVERDUE
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {task.estimatedMinutes && task.estimatedMinutes > 0 ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatMinutes(logged)} / {formatMinutes(task.estimatedMinutes)}
                        </div>
                      ) : logged > 0 ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatMinutes(logged)}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `MyTasksPage` to use `MyTasksTable` instead of `MyTasksBoard`**

Replace the full content of `apps/web/src/pages/MyTasksPage.tsx`:

```typescript
import { CheckSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTasks } from '@/hooks/useMyTasks';
import { useMyTaskSync } from '@/hooks/useTaskSync';
import { MyTasksTable } from '@/components/tasks/MyTasksTable';

export function MyTasksPage() {
  const { data: tasks, isLoading } = useMyTasks();
  useMyTaskSync();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-8 py-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const taskList = tasks ?? [];

  if (taskList.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-8 py-6">
        <h1 className="text-xl font-semibold tracking-tight">My Tasks</h1>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-90 text-center">
            <CheckSquare className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-[20px] font-semibold">No tasks assigned to you</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tasks assigned to you across all projects will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const projectCount = new Set(taskList.map((t) => t.projectId)).size;

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {taskList.length} task{taskList.length !== 1 ? 's' : ''} across {projectCount} project{projectCount !== 1 ? 's' : ''}
        </p>
      </div>
      <MyTasksTable tasks={taskList} />
    </div>
  );
}
```

- [ ] **Step 3: Delete `MyTasksBoard.tsx`**

```bash
rm apps/web/src/components/tasks/MyTasksBoard.tsx
```

- [ ] **Step 4: Verify no other imports reference `MyTasksBoard`**

```bash
grep -r "MyTasksBoard" apps/web/src/
```

Expected: No results (only the deleted file and the now-updated `MyTasksPage` should have referenced it).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tasks/MyTasksTable.tsx apps/web/src/pages/MyTasksPage.tsx
git rm apps/web/src/components/tasks/MyTasksBoard.tsx
git commit -m "feat: replace My Tasks kanban board with filterable table"
```

---

### Task 7: Verify Build and Clean Up

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run API build**

```bash
cd apps/api && npx nest build
```

Expected: No errors.

- [ ] **Step 3: Check for any remaining references to old imports**

```bash
grep -r "ListTodo\|CheckCircle" apps/web/src/pages/ProjectDashboardPage.tsx
grep -r "useEffect.*setFullWidth" apps/web/src/pages/MyTasksPage.tsx
```

Expected: No results — these old imports/patterns should be gone.

- [ ] **Step 4: Commit any cleanup if needed**

If any stale imports or references are found, fix and commit:

```bash
git add -A && git commit -m "chore: clean up stale imports"
```
