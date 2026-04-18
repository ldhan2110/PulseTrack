# Sub-task Filtering & Saved Queries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable task list filters to match sub-tasks (promoting them to flat rows) and let users save/load filter presets with a per-user default that falls back to excluding closed statuses.

**Architecture:** Two features sharing the filter infrastructure. Feature 1 (sub-task filtering) is frontend-only — a `useMemo` transform flattens matching sub-tasks before TanStack Table processes them. Feature 2 (saved queries) spans backend (new Prisma model + NestJS CRUD module) and frontend (new hook + dropdown component). Both features integrate at the page level (BacklogPage, SprintBoardPage) which pass workflow statuses and initial filters into TasksTable.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, TanStack Table, React Query, Tailwind CSS, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/prisma/schema.prisma` | Modify | Add SavedFilter model + relations |
| `apps/api/src/saved-filters/saved-filters.module.ts` | Create | NestJS module registration |
| `apps/api/src/saved-filters/saved-filters.service.ts` | Create | CRUD + default-swap logic |
| `apps/api/src/saved-filters/saved-filters.controller.ts` | Create | REST endpoints |
| `apps/api/src/saved-filters/dto/create-saved-filter.dto.ts` | Create | Validation for create |
| `apps/api/src/saved-filters/dto/update-saved-filter.dto.ts` | Create | Validation for update |
| `apps/api/src/app.module.ts` | Modify | Register SavedFiltersModule |
| `apps/web/src/lib/types.ts` | Modify | Add SavedFilter type |
| `apps/web/src/lib/api.ts` | Modify | Add saved-filter API methods |
| `apps/web/src/hooks/useSavedFilters.ts` | Create | React Query hook for CRUD |
| `apps/web/src/components/tasks/TaskFilters.tsx` | Modify | Export `matchesFilters` utility |
| `apps/web/src/components/tasks/TasksTable.tsx` | Modify | Add flatten logic + initialFilters prop + workflowStatuses prop |
| `apps/web/src/components/tasks/SavedQueryDropdown.tsx` | Create | Dropdown UI component |
| `apps/web/src/pages/BacklogPage.tsx` | Modify | Integrate workflow statuses + SavedQueryDropdown |
| `apps/web/src/pages/SprintBoardPage.tsx` | Modify | Integrate workflow statuses + SavedQueryDropdown |

---

### Task 1: Prisma Schema — Add SavedFilter Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add SavedFilter model to schema.prisma**

Add after the last model in the file:

```prisma
model SavedFilter {
  id         String   @id @default(cuid())
  userId     String
  projectId  String
  entityType String   // "task" | "bug"
  name       String
  filters    Json     // { statuses?: string[], assignees?: string[], sprint?: string, progress?: string[], search?: string }
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId, entityType, name])
  @@index([userId, projectId, entityType])
}
```

- [ ] **Step 2: Add relation fields to User and Project models**

In the `User` model (around line 218, before the closing `}`), add:

```prisma
  savedFilters        SavedFilter[]
```

In the `Project` model (around line 263, before the closing `}`), add:

```prisma
  savedFilters        SavedFilter[]
```

- [ ] **Step 3: Generate and run the migration**

Run:
```bash
cd apps/api && npx prisma migrate dev --name add-saved-filter
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 4: Verify Prisma client generation**

Run:
```bash
cd apps/api && npx prisma generate
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add SavedFilter prisma model with user and project relations"
```

---

### Task 2: Backend — SavedFilters NestJS Module

**Files:**
- Create: `apps/api/src/saved-filters/saved-filters.module.ts`
- Create: `apps/api/src/saved-filters/dto/create-saved-filter.dto.ts`
- Create: `apps/api/src/saved-filters/dto/update-saved-filter.dto.ts`
- Create: `apps/api/src/saved-filters/saved-filters.service.ts`
- Create: `apps/api/src/saved-filters/saved-filters.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the DTOs**

Create `apps/api/src/saved-filters/dto/create-saved-filter.dto.ts`:

```typescript
import { IsString, IsIn, IsObject, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateSavedFilterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIn(['task', 'bug'])
  entityType: string;

  @IsObject()
  filters: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
```

Create `apps/api/src/saved-filters/dto/update-saved-filter.dto.ts`:

```typescript
import { IsString, IsObject, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class UpdateSavedFilterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
```

- [ ] **Step 2: Create the service**

Create `apps/api/src/saved-filters/saved-filters.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Injectable()
export class SavedFiltersService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string, userId: string, entityType?: string) {
    return this.prisma.savedFilter.findMany({
      where: {
        projectId,
        userId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(projectId: string, userId: string, dto: CreateSavedFilterDto) {
    if (dto.isDefault) {
      await this.prisma.savedFilter.updateMany({
        where: { userId, projectId, entityType: dto.entityType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.savedFilter.create({
      data: {
        projectId,
        userId,
        name: dto.name,
        entityType: dto.entityType,
        filters: dto.filters,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateSavedFilterDto) {
    const existing = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Saved filter not found');
    }

    if (dto.isDefault === true) {
      await this.prisma.savedFilter.updateMany({
        where: { userId, projectId: existing.projectId, entityType: existing.entityType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.savedFilter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.filters !== undefined ? { filters: dto.filters } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Saved filter not found');
    }

    return this.prisma.savedFilter.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Create the controller**

Create `apps/api/src/saved-filters/saved-filters.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { SavedFiltersService } from './saved-filters.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Controller('projects/:projectId/saved-filters')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class SavedFiltersController {
  constructor(private savedFiltersService: SavedFiltersService) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('entityType') entityType: string | undefined,
    @Req() req: any,
  ) {
    return this.savedFiltersService.findAll(projectId, req.user.id, entityType);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSavedFilterDto,
    @Req() req: any,
  ) {
    return this.savedFiltersService.create(projectId, req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSavedFilterDto,
    @Req() req: any,
  ) {
    return this.savedFiltersService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.savedFiltersService.remove(id, req.user.id);
  }
}
```

- [ ] **Step 4: Create the module**

Create `apps/api/src/saved-filters/saved-filters.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SavedFiltersController } from './saved-filters.controller';
import { SavedFiltersService } from './saved-filters.service';

@Module({
  imports: [PrismaModule],
  controllers: [SavedFiltersController],
  providers: [SavedFiltersService],
})
export class SavedFiltersModule {}
```

- [ ] **Step 5: Register module in app.module.ts**

In `apps/api/src/app.module.ts`, add the import at the top (after the WatchersModule import around line 29):

```typescript
import { SavedFiltersModule } from './saved-filters/saved-filters.module';
```

Add `SavedFiltersModule` to the `imports` array (after `WatchersModule`).

- [ ] **Step 6: Verify TypeScript compilation**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/saved-filters/ apps/api/src/app.module.ts
git commit -m "feat: add saved-filters backend module with CRUD endpoints"
```

---

### Task 3: Frontend Types & API Client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add SavedFilter type to types.ts**

In `apps/web/src/lib/types.ts`, add after the `TaskHistoryEntry` interface (around line 479):

```typescript
// ─── Saved Filters ──────────────────────────────────────────────────────────

export interface SavedFilterData {
  statuses?: string[];
  assignees?: string[];
  sprint?: string;
  progress?: string[];
  search?: string;
}

export interface SavedFilter {
  id: string;
  userId: string;
  projectId: string;
  entityType: 'task' | 'bug';
  name: string;
  filters: SavedFilterData;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedFilterPayload {
  name: string;
  entityType: 'task' | 'bug';
  filters: SavedFilterData;
  isDefault?: boolean;
}

export interface UpdateSavedFilterPayload {
  name?: string;
  filters?: SavedFilterData;
  isDefault?: boolean;
}
```

- [ ] **Step 2: Add API methods to api.ts**

In `apps/web/src/lib/api.ts`, add a new section after the Workflow section (around line 343):

```typescript
  // ─── Saved Filters ────────────────────────────────────────────────────────
  getSavedFilters: (projectId: string, entityType?: string) =>
    request<SavedFilter[]>(`/projects/${projectId}/saved-filters${entityType ? `?entityType=${entityType}` : ''}`),
  createSavedFilter: (projectId: string, data: CreateSavedFilterPayload) =>
    request<SavedFilter>(`/projects/${projectId}/saved-filters`, { method: 'POST', body: JSON.stringify(data) }),
  updateSavedFilter: (projectId: string, id: string, data: UpdateSavedFilterPayload) =>
    request<SavedFilter>(`/projects/${projectId}/saved-filters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSavedFilter: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/saved-filters/${id}`, { method: 'DELETE' }),
```

Add the imports at the top of api.ts for the new types:

```typescript
import type { SavedFilter, CreateSavedFilterPayload, UpdateSavedFilterPayload } from './types';
```

(Merge into the existing import statement from `'./types'`.)

- [ ] **Step 3: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat: add SavedFilter types and API client methods"
```

---

### Task 4: Frontend Hook — useSavedFilters

**Files:**
- Create: `apps/web/src/hooks/useSavedFilters.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/useSavedFilters.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateSavedFilterPayload, UpdateSavedFilterPayload } from '../lib/types';

export function useSavedFilters(projectId: string, entityType: 'task' | 'bug') {
  return useQuery({
    queryKey: ['saved-filters', projectId, entityType],
    queryFn: () => api.getSavedFilters(projectId, entityType),
    enabled: !!projectId,
  });
}

export function useCreateSavedFilter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSavedFilterPayload) => api.createSavedFilter(projectId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['saved-filters', projectId, variables.entityType] });
      toast.success('Filter saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSavedFilter(projectId: string, entityType: 'task' | 'bug') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedFilterPayload }) =>
      api.updateSavedFilter(projectId, id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-filters', projectId, entityType] });
      toast.success('Filter updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSavedFilter(projectId: string, entityType: 'task' | 'bug') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSavedFilter(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-filters', projectId, entityType] });
      toast.success('Filter deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useSavedFilters.ts
git commit -m "feat: add useSavedFilters React Query hooks"
```

---

### Task 5: Sub-task Filtering — matchesFilters Utility & Flatten Logic

**Files:**
- Modify: `apps/web/src/components/tasks/TaskFilters.tsx`
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`

- [ ] **Step 1: Export matchesFilters from TaskFilters.tsx**

At the bottom of `apps/web/src/components/tasks/TaskFilters.tsx` (after the existing `progressFilterFn`), add:

```typescript
import type { ColumnFiltersState } from '@tanstack/react-table';

export function matchesFilters(
  task: Task,
  columnFilters: ColumnFiltersState,
  globalFilter: string,
): boolean {
  for (const filter of columnFilters) {
    const { id, value } = filter;
    switch (id) {
      case 'workflowStatusId': {
        if (!statusFilterFn({ getValue: () => task.workflowStatusId }, id, value as string[])) return false;
        break;
      }
      case 'assigneeId': {
        if (!assigneeFilterFn({ getValue: () => task.assigneeId ?? null }, id, value as string[])) return false;
        break;
      }
      case 'sprintId': {
        if (!sprintFilterFn({ getValue: () => task.sprintId ?? null }, id, value as string)) return false;
        break;
      }
      case 'progress': {
        const progress = task.progress ?? 0;
        if (!progressFilterFn({ getValue: () => progress }, id, value as string[])) return false;
        break;
      }
    }
  }

  if (globalFilter) {
    const search = globalFilter.toLowerCase();
    const titleMatch = task.title.toLowerCase().includes(search);
    const keyMatch = task.taskKey?.toLowerCase().includes(search) ?? false;
    if (!titleMatch && !keyMatch) return false;
  }

  return true;
}
```

Also add the `ColumnFiltersState` import at the top of TaskFilters.tsx. It is already imported in the file's type imports via `Table` — add it explicitly:

Add to the existing `@tanstack/react-table` import in TaskFilters.tsx (line 2):

```typescript
import type { Table, ColumnFiltersState } from '@tanstack/react-table';
```

- [ ] **Step 2: Add flatten logic to TasksTable.tsx**

In `apps/web/src/components/tasks/TasksTable.tsx`, update the import from TaskFilters (line 37) to include `matchesFilters`:

```typescript
import { TaskFilters, statusFilterFn, assigneeFilterFn, sprintFilterFn, progressFilterFn, matchesFilters } from './TaskFilters';
```

Add the `useMemo` flatten transform after the `expandedRows` state (after line 124) and before the `sprintMap` memo:

```typescript
  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== '';

  const processedTasks = useMemo(() => {
    if (!hasActiveFilters) return tasks;

    const result: Task[] = [];
    for (const parent of tasks) {
      const parentMatches = matchesFilters(parent, columnFilters, globalFilter);
      const matchingChildren = (parent.children ?? []).filter((child) =>
        matchesFilters(child, columnFilters, globalFilter),
      );

      if (parentMatches) {
        result.push({
          ...parent,
          children: matchingChildren,
        });
      } else if (matchingChildren.length > 0) {
        for (const child of matchingChildren) {
          result.push({
            ...child,
            _promotedFromParent: parent,
          } as Task & { _promotedFromParent?: Task });
        }
      }
    }
    return result;
  }, [tasks, columnFilters, globalFilter, hasActiveFilters]);
```

- [ ] **Step 3: Add _promotedFromParent type augmentation**

At the top of `TasksTable.tsx`, after the existing type imports (line 41), add:

```typescript
type ProcessedTask = Task & { _promotedFromParent?: Task };
```

Update the `processedTasks` memo to use `ProcessedTask[]` — change the `result` type:

```typescript
    const result: ProcessedTask[] = [];
```

And the promoted child push:

```typescript
        result.push({
          ...child,
          _promotedFromParent: parent,
        });
```

- [ ] **Step 4: Use processedTasks instead of tasks in useReactTable**

In `TasksTable.tsx`, change `useReactTable` data from `tasks` to `processedTasks` (line 385):

```typescript
  const table = useReactTable({
    data: processedTasks,
```

- [ ] **Step 5: Update title cell to show breadcrumb for promoted sub-tasks**

In the `title` column definition (around line 183), update the cell renderer:

```typescript
        cell: ({ row }) => {
          const task = row.original as ProcessedTask;
          const promoted = task._promotedFromParent;
          const hasChildren = !promoted && (task.children?.length ?? 0) > 0;
          return (
            <span className={cn('text-sm truncate block max-w-[400px]', hasChildren ? 'font-semibold' : 'font-medium')} title={task.title}>
              {promoted && promoted.taskKey && (
                <span className="font-mono text-xs text-muted-foreground/60 mr-1">{promoted.taskKey} &gt; </span>
              )}
              {task.taskKey && (
                <span className="font-mono text-xs text-muted-foreground mr-2">{task.taskKey}</span>
              )}
              {task.title}
            </span>
          );
        },
```

- [ ] **Step 6: Update expand cell to hide chevron for promoted sub-tasks**

In the `expand` column definition (around line 139), update the cell renderer:

```typescript
        cell: ({ row }: { row: { original: Task } }) => {
          const task = row.original as ProcessedTask;
          if (task._promotedFromParent) return null;
          const hasChildren = (task.children?.length ?? 0) > 0;
          if (!hasChildren) return null;
          const isExpanded = expandedRows.has(task.id);
          return (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          );
        },
```

- [ ] **Step 7: Update row selection to use processedTasks**

In the `onRowSelectionChange` callback (around line 396), change `tasks` to `processedTasks`:

```typescript
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (onRowSelectionChange) {
          const selectedTasks = processedTasks.filter((_, idx) => next[idx]);
          onRowSelectionChange(selectedTasks);
        }
        return next;
      });
    },
```

- [ ] **Step 8: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/tasks/TaskFilters.tsx apps/web/src/components/tasks/TasksTable.tsx
git commit -m "feat: add sub-task filtering with promote-to-flat-row behavior"
```

---

### Task 6: TasksTable — Accept initialFilters and workflowStatuses Props

**Files:**
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`

- [ ] **Step 1: Add new props to TasksTableProps interface**

In `TasksTable.tsx`, update the `TasksTableProps` interface (around line 90):

```typescript
interface TasksTableProps {
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
  members: Member[];
  sprints: Sprint[];
  isLoading?: boolean;
  onRowSelectionChange?: (selected: Task[]) => void;
  workflowStatuses?: WorkflowStatus[];
  initialFilters?: ColumnFiltersState;
}
```

Add `WorkflowStatus` to the import from `@/lib/types` (line 41):

```typescript
import type { Task, Member, Sprint, Priority, WorkflowStatus } from '@/lib/types';
```

Add `ColumnFiltersState` to the import from `@tanstack/react-table` if not already there (it already is at line 10).

- [ ] **Step 2: Destructure new props and wire initialFilters**

Update the component destructuring (around line 100) to include the new props:

```typescript
export function TasksTable({
  tasks,
  projectId,
  projectPrefix,
  members,
  sprints,
  isLoading,
  onRowSelectionChange,
  workflowStatuses,
  initialFilters,
}: TasksTableProps) {
```

Update the `columnFilters` state initialization (line 112) to use `initialFilters`:

```typescript
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters ?? []);
```

Add a `useEffect` to reset filters when `initialFilters` changes (after the state declarations):

```typescript
  useEffect(() => {
    if (initialFilters) {
      setColumnFilters(initialFilters);
    }
  }, [initialFilters]);
```

Add `useEffect` to imports from React (line 1):

```typescript
import React, { useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 3: Pass workflowStatuses to TaskFilters**

Update the `TaskFilters` usage (around line 423) to pass `workflowStatuses`:

```typescript
      <TaskFilters
        table={table}
        members={members}
        sprints={sprints}
        workflowStatuses={workflowStatuses}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />
```

- [ ] **Step 4: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tasks/TasksTable.tsx
git commit -m "feat: add workflowStatuses and initialFilters props to TasksTable"
```

---

### Task 7: SavedQueryDropdown Component

**Files:**
- Create: `apps/web/src/components/tasks/SavedQueryDropdown.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/tasks/SavedQueryDropdown.tsx`:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedFilter, SavedFilterData } from '@/lib/types';

interface SavedQueryDropdownProps {
  savedFilters: SavedFilter[];
  activeFilterId: string | null;
  isModified: boolean;
  onSelect: (filter: SavedFilter) => void;
  onSave: (name: string, isDefault: boolean) => void;
  onSetDefault: (id: string, isDefault: boolean) => void;
  onDelete: (id: string) => void;
}

export function SavedQueryDropdown({
  savedFilters,
  activeFilterId,
  isModified,
  onSelect,
  onSave,
  onSetDefault,
  onDelete,
}: SavedQueryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const activeFilter = savedFilters.find((f) => f.id === activeFilterId);
  const label = activeFilter
    ? `${activeFilter.name}${isModified ? ' (modified)' : ''}`
    : 'Saved Queries';

  const handleSave = () => {
    if (!newName.trim()) return;
    onSave(newName.trim(), false);
    setNewName('');
    setIsSaving(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5',
            activeFilterId && 'border-primary',
          )}
        >
          {label}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {savedFilters.length === 0 && !isSaving && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No saved queries yet</p>
          )}
          {savedFilters.map((filter) => (
            <div
              key={filter.id}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1.5 hover:bg-muted text-sm group cursor-pointer',
                filter.id === activeFilterId && 'bg-muted',
              )}
              onClick={() => { onSelect(filter); setIsOpen(false); }}
            >
              <span className="flex-1 truncate">{filter.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onSetDefault(filter.id, !filter.isDefault); }}
                className="shrink-0 p-0.5 hover:bg-muted-foreground/10 rounded"
                title={filter.isDefault ? 'Remove as default' : 'Set as default'}
              >
                <Star
                  className={cn(
                    'size-3.5',
                    filter.isDefault ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground opacity-0 group-hover:opacity-100',
                  )}
                />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(filter.id); }}
                className="shrink-0 p-0.5 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t mt-1 pt-1">
          {isSaving ? (
            <div className="flex items-center gap-1">
              <Input
                placeholder="Query name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsSaving(false); }}
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSave}>
                Save
              </Button>
            </div>
          ) : (
            <button
              className="w-full text-left text-sm text-muted-foreground px-2 py-1.5 hover:bg-muted rounded"
              onClick={() => setIsSaving(true)}
            >
              Save current filters...
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/SavedQueryDropdown.tsx
git commit -m "feat: add SavedQueryDropdown component"
```

---

### Task 8: Integrate into BacklogPage

**Files:**
- Modify: `apps/web/src/pages/BacklogPage.tsx`

- [ ] **Step 1: Add imports**

At the top of `apps/web/src/pages/BacklogPage.tsx`, add the new imports:

```typescript
import { useWorkflow } from '@/hooks/useWorkflow';
import { useSavedFilters, useCreateSavedFilter, useUpdateSavedFilter, useDeleteSavedFilter } from '@/hooks/useSavedFilters';
import { SavedQueryDropdown } from '@/components/tasks/SavedQueryDropdown';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { SavedFilter, SavedFilterData } from '@/lib/types';
```

- [ ] **Step 2: Add workflow and saved filter hooks**

After the existing `useMembers` hook call (around line 29), add:

```typescript
  const { data: workflow } = useWorkflow(projectId);
  const workflowStatuses = workflow?.statuses ?? [];
  const { data: savedFilters = [] } = useSavedFilters(projectId, 'task');
  const createSavedFilter = useCreateSavedFilter(projectId);
  const updateSavedFilter = useUpdateSavedFilter(projectId, 'task');
  const deleteSavedFilter = useDeleteSavedFilter(projectId, 'task');
```

- [ ] **Step 3: Add filter state management**

After the hook calls, add state for tracking the active saved filter:

```typescript
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [isFilterModified, setIsFilterModified] = useState(false);

  // Resolve initial filters: user default → hardcoded default (exclude closed statuses)
  const defaultSavedFilter = savedFilters.find((f) => f.isDefault);

  const initialFilters = useMemo<ColumnFiltersState>(() => {
    if (defaultSavedFilter) {
      return savedFilterDataToColumnFilters(defaultSavedFilter.filters);
    }
    // Hardcoded default: exclude closed statuses
    const openStatusIds = workflowStatuses
      .filter((s) => !s.isClosed)
      .map((s) => s.id);
    if (openStatusIds.length > 0 && openStatusIds.length < workflowStatuses.length) {
      return [{ id: 'workflowStatusId', value: openStatusIds }];
    }
    return [];
  }, [defaultSavedFilter, workflowStatuses]);

  // Set active filter on load
  useEffect(() => {
    if (defaultSavedFilter && !activeFilterId) {
      setActiveFilterId(defaultSavedFilter.id);
    }
  }, [defaultSavedFilter, activeFilterId]);
```

Add the `useMemo` and `useEffect` to the existing React imports if not already imported.

Add this helper function **before** the component (outside BacklogPage):

```typescript
function savedFilterDataToColumnFilters(data: SavedFilterData): ColumnFiltersState {
  const filters: ColumnFiltersState = [];
  if (data.statuses && data.statuses.length > 0) {
    filters.push({ id: 'workflowStatusId', value: data.statuses });
  }
  if (data.assignees && data.assignees.length > 0) {
    filters.push({ id: 'assigneeId', value: data.assignees });
  }
  if (data.sprint) {
    filters.push({ id: 'sprintId', value: data.sprint });
  }
  if (data.progress && data.progress.length > 0) {
    filters.push({ id: 'progress', value: data.progress });
  }
  return filters;
}

function columnFiltersToSavedFilterData(filters: ColumnFiltersState, globalFilter: string): SavedFilterData {
  const data: SavedFilterData = {};
  for (const f of filters) {
    switch (f.id) {
      case 'workflowStatusId': data.statuses = f.value as string[]; break;
      case 'assigneeId': data.assignees = f.value as string[]; break;
      case 'sprintId': data.sprint = f.value as string; break;
      case 'progress': data.progress = f.value as string[]; break;
    }
  }
  if (globalFilter) data.search = globalFilter;
  return data;
}
```

- [ ] **Step 4: Add SavedQueryDropdown handlers**

After the filter state management code, add:

```typescript
  const handleSelectFilter = (filter: SavedFilter) => {
    setActiveFilterId(filter.id);
    setIsFilterModified(false);
  };

  const handleSaveFilter = (name: string, isDefault: boolean) => {
    // We need current filters from the table — use a ref or callback
    // For now, save with the initial filters (will be refined in integration)
    createSavedFilter.mutate({
      name,
      entityType: 'task',
      filters: {},
      isDefault,
    });
  };

  const handleSetDefault = (id: string, isDefault: boolean) => {
    updateSavedFilter.mutate({ id, data: { isDefault } });
  };

  const handleDeleteFilter = (id: string) => {
    deleteSavedFilter.mutate(id);
    if (activeFilterId === id) {
      setActiveFilterId(null);
      setIsFilterModified(false);
    }
  };
```

- [ ] **Step 5: Add SavedQueryDropdown and workflowStatuses to the template**

Before the `<Tabs>` component (around line 232), add the SavedQueryDropdown. Wrap both the dropdown and tabs in a container:

```typescript
      <div className="flex items-center gap-2 mb-2">
        <SavedQueryDropdown
          savedFilters={savedFilters}
          activeFilterId={activeFilterId}
          isModified={isFilterModified}
          onSelect={handleSelectFilter}
          onSave={handleSaveFilter}
          onSetDefault={handleSetDefault}
          onDelete={handleDeleteFilter}
        />
      </div>
```

Update the `TasksTable` usage to pass the new props:

```typescript
          <TasksTable
            tasks={taskList}
            projectId={projectId}
            projectPrefix={projectPrefix}
            members={members}
            sprints={sprints}
            workflowStatuses={workflowStatuses}
            initialFilters={initialFilters}
            onRowSelectionChange={setSelectedTasks}
          />
```

- [ ] **Step 6: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/BacklogPage.tsx
git commit -m "feat: integrate saved queries and workflow statuses into BacklogPage"
```

---

### Task 9: Integrate into SprintBoardPage

**Files:**
- Modify: `apps/web/src/pages/SprintBoardPage.tsx`

- [ ] **Step 1: Add imports**

At the top of `apps/web/src/pages/SprintBoardPage.tsx`, add:

```typescript
import { useWorkflow } from '@/hooks/useWorkflow';
import { useSavedFilters, useCreateSavedFilter, useUpdateSavedFilter, useDeleteSavedFilter } from '@/hooks/useSavedFilters';
import { SavedQueryDropdown } from '@/components/tasks/SavedQueryDropdown';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { SavedFilter, SavedFilterData } from '@/lib/types';
```

- [ ] **Step 2: Add hooks and state**

After existing hook calls, add the same pattern as BacklogPage:

```typescript
  const { data: workflow } = useWorkflow(projectId);
  const workflowStatuses = workflow?.statuses ?? [];
  const { data: savedFilters = [] } = useSavedFilters(projectId, 'task');
  const createSavedFilter = useCreateSavedFilter(projectId);
  const updateSavedFilter = useUpdateSavedFilter(projectId, 'task');
  const deleteSavedFilter = useDeleteSavedFilter(projectId, 'task');

  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [isFilterModified, setIsFilterModified] = useState(false);

  const defaultSavedFilter = savedFilters.find((f) => f.isDefault);

  const initialFilters = useMemo<ColumnFiltersState>(() => {
    if (defaultSavedFilter) {
      return savedFilterDataToColumnFilters(defaultSavedFilter.filters);
    }
    const openStatusIds = workflowStatuses
      .filter((s) => !s.isClosed)
      .map((s) => s.id);
    if (openStatusIds.length > 0 && openStatusIds.length < workflowStatuses.length) {
      return [{ id: 'workflowStatusId', value: openStatusIds }];
    }
    return [];
  }, [defaultSavedFilter, workflowStatuses]);

  useEffect(() => {
    if (defaultSavedFilter && !activeFilterId) {
      setActiveFilterId(defaultSavedFilter.id);
    }
  }, [defaultSavedFilter, activeFilterId]);

  const handleSelectFilter = (filter: SavedFilter) => {
    setActiveFilterId(filter.id);
    setIsFilterModified(false);
  };

  const handleSaveFilter = (name: string, isDefault: boolean) => {
    createSavedFilter.mutate({ name, entityType: 'task', filters: {}, isDefault });
  };

  const handleSetDefault = (id: string, isDefault: boolean) => {
    updateSavedFilter.mutate({ id, data: { isDefault } });
  };

  const handleDeleteFilter = (id: string) => {
    deleteSavedFilter.mutate(id);
    if (activeFilterId === id) {
      setActiveFilterId(null);
      setIsFilterModified(false);
    }
  };
```

Add `savedFilterDataToColumnFilters` and `columnFiltersToSavedFilterData` helper functions before the component — same as in BacklogPage. **Note:** These helpers are duplicated. In a future refactor they could be extracted to a shared utility, but for now keeping them co-located with each page is acceptable since the logic is small.

- [ ] **Step 3: Add SavedQueryDropdown and update TasksTable props**

Add the SavedQueryDropdown before the Tabs component (similar position as BacklogPage):

```typescript
        <div className="flex items-center gap-2 mb-2">
          <SavedQueryDropdown
            savedFilters={savedFilters}
            activeFilterId={activeFilterId}
            isModified={isFilterModified}
            onSelect={handleSelectFilter}
            onSave={handleSaveFilter}
            onSetDefault={handleSetDefault}
            onDelete={handleDeleteFilter}
          />
        </div>
```

Update the `TasksTable` usage (around line 174):

```typescript
            <TasksTable
              tasks={sprintTasks}
              projectId={projectId}
              projectPrefix={projectPrefix}
              members={members}
              sprints={sprints}
              workflowStatuses={workflowStatuses}
              initialFilters={initialFilters}
            />
```

- [ ] **Step 4: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/SprintBoardPage.tsx
git commit -m "feat: integrate saved queries and workflow statuses into SprintBoardPage"
```

---

### Task 10: Wire Save Current Filters — Lift Filter State

**Files:**
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`
- Modify: `apps/web/src/pages/BacklogPage.tsx`
- Modify: `apps/web/src/pages/SprintBoardPage.tsx`

The `handleSaveFilter` in Tasks 8-9 currently saves empty filters because it doesn't know the table's current filter state. We need to expose the current filters from TasksTable.

- [ ] **Step 1: Add onFiltersChange callback to TasksTable**

In `TasksTable.tsx`, add a new prop to `TasksTableProps`:

```typescript
  onFiltersChange?: (filters: ColumnFiltersState, globalFilter: string) => void;
```

After the `setColumnFilters` and `setGlobalFilter` calls, add a `useEffect` to notify the parent:

```typescript
  useEffect(() => {
    onFiltersChange?.(columnFilters, globalFilter);
  }, [columnFilters, globalFilter, onFiltersChange]);
```

Destructure `onFiltersChange` in the component props.

- [ ] **Step 2: Track current filters in BacklogPage**

In `BacklogPage.tsx`, add a ref to hold current filters:

```typescript
  const currentFiltersRef = useRef<{ filters: ColumnFiltersState; globalFilter: string }>({ filters: [], globalFilter: '' });
```

Add a handler:

```typescript
  const handleFiltersChange = useCallback((filters: ColumnFiltersState, globalFilter: string) => {
    currentFiltersRef.current = { filters, globalFilter };
    setIsFilterModified(true);
  }, []);
```

Pass it to TasksTable:

```typescript
            onFiltersChange={handleFiltersChange}
```

Update `handleSaveFilter`:

```typescript
  const handleSaveFilter = (name: string, isDefault: boolean) => {
    const { filters, globalFilter } = currentFiltersRef.current;
    createSavedFilter.mutate({
      name,
      entityType: 'task',
      filters: columnFiltersToSavedFilterData(filters, globalFilter),
      isDefault,
    });
  };
```

Add `useRef` and `useCallback` to React imports.

- [ ] **Step 3: Do the same in SprintBoardPage**

Apply the same pattern: `currentFiltersRef`, `handleFiltersChange` callback, updated `handleSaveFilter`, pass `onFiltersChange` to TasksTable.

- [ ] **Step 4: Verify TypeScript compilation**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tasks/TasksTable.tsx apps/web/src/pages/BacklogPage.tsx apps/web/src/pages/SprintBoardPage.tsx
git commit -m "feat: wire save current filters by lifting filter state to parent pages"
```

---

### Task 11: End-to-End Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start the dev servers**

Run:
```bash
cd apps/api && npm run start:dev &
cd apps/web && npm run dev &
```

- [ ] **Step 2: Test sub-task filtering**

1. Navigate to a project's Backlog page
2. Create a parent task with 2 sub-tasks, assign them to different people
3. Use the Assignee filter to select one person
4. Verify: if the parent doesn't match but a sub-task does, the sub-task appears as a flat row with breadcrumb prefix (e.g., `PM-5 > PM-5-1`)
5. Clear filters — verify normal hierarchical view returns

- [ ] **Step 3: Test default filter (exclude Done)**

1. On the Backlog page, verify that tasks with closed/Done status are hidden by default
2. The Status filter button should now be visible (workflowStatuses are being passed)
3. Open the Status filter dropdown — closed statuses should NOT be pre-checked

- [ ] **Step 4: Test saved queries**

1. Apply some filters (e.g., select an assignee + a status)
2. Click "Saved Queries" dropdown → "Save current filters..." → enter a name → Save
3. Clear all filters
4. Click "Saved Queries" → select the saved query → verify filters are restored
5. Click the star icon on a saved query → verify it becomes the default
6. Refresh the page → verify the default query is automatically applied
7. Delete a saved query → verify it's removed from the list

- [ ] **Step 5: Test Sprint Board page**

Repeat steps 2-4 on the Sprint Board page to verify the same behavior works there.
