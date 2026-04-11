# Export Excel for Tasks & Bugs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side Excel export endpoints for Tasks and Bugs with dedicated filter dialogs on the frontend.

**Architecture:** Backend adds `exportExcel()` methods to `TasksService` and `BugsService` that query with filters, build an Excel workbook using `exceljs`, and stream back the buffer. Frontend adds two export dialog components with filter controls that trigger authenticated downloads.

**Tech Stack:** NestJS, Prisma, exceljs (new backend dep), React, TanStack Query, shadcn/ui, xlsx types (frontend)

---

### Task 1: Install exceljs in the API

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install exceljs**

```bash
cd apps/api && npm install exceljs
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/api && node -e "require('exceljs')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json
git commit -m "chore: install exceljs in api for Excel export"
```

Note: if this is a monorepo with root lockfile, also add the root `package-lock.json`.

---

### Task 2: Tasks export — service method

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`

- [ ] **Step 1: Add the `exportExcel` method to `TasksService`**

Add this method at the end of the `TasksService` class (before the closing `}`). It must be placed after all existing methods.

```typescript
async exportExcel(projectId: string, filters: {
  workflowStatusId?: string;
  assigneeId?: string;
  sprintId?: string;
  priority?: string;
  plannedStartFrom?: string;
  plannedStartTo?: string;
  plannedEndFrom?: string;
  plannedEndTo?: string;
  overdue?: string;
  search?: string;
}): Promise<Buffer> {
  const where: any = { projectId, parentId: null };

  if (filters.workflowStatusId) {
    where.workflowStatusId = { in: filters.workflowStatusId.split(',') };
  }
  if (filters.assigneeId) {
    where.assigneeId = { in: filters.assigneeId.split(',') };
  }
  if (filters.sprintId) {
    where.sprintId = { in: filters.sprintId.split(',') };
  }
  if (filters.priority) {
    where.priority = { in: filters.priority.split(',') };
  }
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  // Date filters on plannedStartDate
  if (filters.plannedStartFrom || filters.plannedStartTo) {
    where.plannedStartDate = {};
    if (filters.plannedStartFrom) where.plannedStartDate.gte = new Date(filters.plannedStartFrom);
    if (filters.plannedStartTo) where.plannedStartDate.lte = new Date(filters.plannedStartTo);
  }

  // Date filters on plannedEndDate
  if (filters.plannedEndFrom || filters.plannedEndTo) {
    where.plannedEndDate = {};
    if (filters.plannedEndFrom) where.plannedEndDate.gte = new Date(filters.plannedEndFrom);
    if (filters.plannedEndTo) where.plannedEndDate.lte = new Date(filters.plannedEndTo);
  }

  // Overdue: plannedEndDate < now AND no actualEndDate
  if (filters.overdue === 'true') {
    where.plannedEndDate = { ...where.plannedEndDate, lt: new Date() };
    where.actualEndDate = null;
  }

  const tasks = await this.prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, username: true, name: true } },
      sprint: { select: { id: true, name: true } },
      workflowStatus: true,
      timeLogs: { select: { minutes: true } },
      children: {
        include: {
          assignee: { select: { id: true, username: true, name: true } },
          workflowStatus: true,
          timeLogs: { select: { minutes: true } },
          sprint: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Flatten: parent tasks + their children
  const rows: any[] = [];
  for (const task of tasks) {
    rows.push(task);
    if (task.children) {
      for (const child of task.children) {
        rows.push(child);
      }
    }
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tasks');

  sheet.columns = [
    { header: 'Task Key', key: 'taskKey', width: 14 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Assignee', key: 'assignee', width: 20 },
    { header: 'Sprint', key: 'sprint', width: 18 },
    { header: 'Story Points', key: 'storyPoints', width: 14 },
    { header: 'Estimated (min)', key: 'estimatedMinutes', width: 16 },
    { header: 'Time Logged (min)', key: 'timeLogged', width: 18 },
    { header: 'Planned Start', key: 'plannedStartDate', width: 16 },
    { header: 'Planned End', key: 'plannedEndDate', width: 16 },
    { header: 'Actual Start', key: 'actualStartDate', width: 16 },
    { header: 'Actual End', key: 'actualEndDate', width: 16 },
    { header: 'Created At', key: 'createdAt', width: 20 },
  ];

  // Bold header row
  sheet.getRow(1).font = { bold: true };

  for (const t of rows) {
    const totalMinutes = (t.timeLogs ?? []).reduce((sum: number, tl: any) => sum + tl.minutes, 0);
    sheet.addRow({
      taskKey: t.taskKey ?? '',
      title: t.title,
      description: t.description ?? '',
      status: t.workflowStatus?.name ?? '',
      priority: t.priority ?? '',
      assignee: t.assignee?.name ?? t.assignee?.username ?? '',
      sprint: t.sprint?.name ?? '',
      storyPoints: t.storyPoints ?? '',
      estimatedMinutes: t.estimatedMinutes ?? '',
      timeLogged: totalMinutes || '',
      plannedStartDate: t.plannedStartDate ? new Date(t.plannedStartDate).toISOString().split('T')[0] : '',
      plannedEndDate: t.plannedEndDate ? new Date(t.plannedEndDate).toISOString().split('T')[0] : '',
      actualStartDate: t.actualStartDate ? new Date(t.actualStartDate).toISOString().split('T')[0] : '',
      actualEndDate: t.actualEndDate ? new Date(t.actualEndDate).toISOString().split('T')[0] : '',
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

- [ ] **Step 2: Add the exceljs import at the top of the file (if not using dynamic import)**

The method above uses `await import('exceljs')` so no top-level import is needed. No change required here.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/tasks.service.ts
git commit -m "feat: add exportExcel method to TasksService"
```

---

### Task 3: Tasks export — controller endpoint

**Files:**
- Modify: `apps/api/src/tasks/tasks.controller.ts`

- [ ] **Step 1: Add `Res`, `Query`, and `Header` imports**

Update the imports at the top of `tasks.controller.ts`. The current import is:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
```

Change it to:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
```

- [ ] **Step 2: Add the export endpoint**

Add this method to `TasksController` **before** the `@Get(':taskId')` route (so NestJS doesn't match `export` as a `:taskId` param):

```typescript
@Get('export')
@Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
async exportExcel(
  @Param('projectId') projectId: string,
  @Query('workflowStatusId') workflowStatusId?: string,
  @Query('assigneeId') assigneeId?: string,
  @Query('sprintId') sprintId?: string,
  @Query('priority') priority?: string,
  @Query('plannedStartFrom') plannedStartFrom?: string,
  @Query('plannedStartTo') plannedStartTo?: string,
  @Query('plannedEndFrom') plannedEndFrom?: string,
  @Query('plannedEndTo') plannedEndTo?: string,
  @Query('overdue') overdue?: string,
  @Query('search') search?: string,
  @Res() res?: Response,
) {
  const buffer = await this.tasksService.exportExcel(projectId, {
    workflowStatusId, assigneeId, sprintId, priority,
    plannedStartFrom, plannedStartTo, plannedEndFrom, plannedEndTo,
    overdue, search,
  });
  const date = new Date().toISOString().split('T')[0];
  res!.set({
    'Content-Disposition': `attachment; filename="tasks-${date}.xlsx"`,
  });
  res!.end(buffer);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/tasks.controller.ts
git commit -m "feat: add GET /tasks/export endpoint"
```

---

### Task 4: Bugs export — service method

**Files:**
- Modify: `apps/api/src/bugs/bugs.service.ts`

- [ ] **Step 1: Add the `exportExcel` method to `BugsService`**

Add this method at the end of the `BugsService` class (before the closing `}`):

```typescript
async exportExcel(projectId: string, filters: {
  workflowStatusId?: string;
  severity?: string;
  assigneeId?: string;
  reporterId?: string;
  search?: string;
}): Promise<Buffer> {
  const where: any = { projectId };

  if (filters.workflowStatusId) {
    where.workflowStatusId = { in: filters.workflowStatusId.split(',') };
  }
  if (filters.severity) {
    where.severity = { in: filters.severity.split(',') };
  }
  if (filters.assigneeId) {
    where.assigneeId = { in: filters.assigneeId.split(',') };
  }
  if (filters.reporterId) {
    where.reporterId = { in: filters.reporterId.split(',') };
  }
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  const bugs = await this.prisma.bug.findMany({
    where,
    include: BUG_RELATIONS,
    orderBy: { createdAt: 'desc' },
  });

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bugs');

  sheet.columns = [
    { header: 'Bug Key', key: 'bugKey', width: 14 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Assignee', key: 'assignee', width: 20 },
    { header: 'Owner', key: 'owner', width: 20 },
    { header: 'Reporter', key: 'reporter', width: 20 },
    { header: 'Environment', key: 'environment', width: 20 },
    { header: 'Preconditions', key: 'preconditions', width: 30 },
    { header: 'Expected Result', key: 'expectedResult', width: 30 },
    { header: 'Actual Result', key: 'actualResult', width: 30 },
    { header: 'Repro Steps', key: 'reproSteps', width: 40 },
    { header: 'Parent Task', key: 'parentTask', width: 14 },
    { header: 'Created At', key: 'createdAt', width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const b of bugs) {
    const reproText = (b.reproSteps ?? [])
      .map((s: any) => `${s.position}. ${s.content}`)
      .join('\n');

    sheet.addRow({
      bugKey: b.bugKey ?? '',
      title: b.title,
      description: b.description ?? '',
      severity: b.severity,
      status: (b as any).workflowStatus?.name ?? '',
      assignee: (b as any).assignee?.name ?? (b as any).assignee?.username ?? '',
      owner: (b as any).owner?.name ?? (b as any).owner?.username ?? '',
      reporter: (b as any).reporter?.name ?? (b as any).reporter?.username ?? '',
      environment: b.environment ?? '',
      preconditions: b.preconditions ?? '',
      expectedResult: b.expectedResult ?? '',
      actualResult: b.actualResult ?? '',
      reproSteps: reproText,
      parentTask: (b as any).parentTask?.taskKey ?? '',
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/bugs/bugs.service.ts
git commit -m "feat: add exportExcel method to BugsService"
```

---

### Task 5: Bugs export — controller endpoint

**Files:**
- Modify: `apps/api/src/bugs/bugs.controller.ts`

- [ ] **Step 1: Add `Res` and `Header` imports**

Update the imports at the top of `bugs.controller.ts`. The current import is:

```typescript
import {
  Body, Controller, Delete, Get,
  Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
```

Change it to:

```typescript
import {
  Body, Controller, Delete, Get, Header,
  Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
```

- [ ] **Step 2: Add the export endpoint**

Add this method to `BugsController` **before** the `@Get('by-key/:bugKey')` route (so NestJS doesn't match `export` as a `:bugId` param). Place it right after the `findAll` method:

```typescript
@Get('export')
@Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
async exportExcel(
  @Param('projectId') projectId: string,
  @Query('workflowStatusId') workflowStatusId?: string,
  @Query('severity') severity?: string,
  @Query('assigneeId') assigneeId?: string,
  @Query('reporterId') reporterId?: string,
  @Query('search') search?: string,
  @Res() res?: Response,
) {
  const buffer = await this.bugsService.exportExcel(projectId, {
    workflowStatusId, severity, assigneeId, reporterId, search,
  });
  const date = new Date().toISOString().split('T')[0];
  res!.set({
    'Content-Disposition': `attachment; filename="bugs-${date}.xlsx"`,
  });
  res!.end(buffer);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/bugs/bugs.controller.ts
git commit -m "feat: add GET /bugs/export endpoint"
```

---

### Task 6: Frontend — download helper and API client methods

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add the `downloadFile` helper function and export methods**

Add this helper function right before the `export const api = {` line:

```typescript
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
```

- [ ] **Step 2: Add export methods to the `api` object**

Add these two methods inside the `api` object, in the Tasks section (after `getMyTasks`) and Bugs section (after `bulkImportBugs`):

In the Tasks section:

```typescript
exportTasks: (projectId: string, params?: Record<string, string>) =>
  downloadFile(`/projects/${projectId}/tasks/export`, params),
```

In the Bugs section:

```typescript
exportBugs: (projectId: string, params?: Record<string, string>) =>
  downloadFile(`/projects/${projectId}/bugs/export`, params),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add exportTasks and exportBugs to API client"
```

---

### Task 7: Frontend — ExportTasksDialog component

**Files:**
- Create: `apps/web/src/components/tasks/ExportTasksDialog.tsx`

- [ ] **Step 1: Create the ExportTasksDialog component**

```tsx
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useMembers } from '@/hooks/useMembers';
import { useSprints } from '@/hooks/useSprints';
import { toast } from 'sonner';
import type { Priority } from '@/lib/types';

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'BLOCKER', label: 'Blocker' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

interface ExportTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ExportTasksDialog({ open, onOpenChange, projectId }: ExportTasksDialogProps) {
  const { data: workflow } = useWorkflow(projectId, 'TASK');
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [plannedStartFrom, setPlannedStartFrom] = useState<Date | undefined>();
  const [plannedStartTo, setPlannedStartTo] = useState<Date | undefined>();
  const [plannedEndFrom, setPlannedEndFrom] = useState<Date | undefined>();
  const [plannedEndTo, setPlannedEndTo] = useState<Date | undefined>();
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    const idx = arr.indexOf(val);
    if (idx >= 0) setter(arr.filter((_, i) => i !== idx));
    else setter([...arr, val]);
  };

  const hasFilters =
    selectedStatuses.length > 0 || selectedAssignees.length > 0 ||
    selectedSprints.length > 0 || selectedPriorities.length > 0 ||
    !!plannedStartFrom || !!plannedStartTo ||
    !!plannedEndFrom || !!plannedEndTo ||
    overdue || search !== '';

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (selectedStatuses.length) p.workflowStatusId = selectedStatuses.join(',');
    if (selectedAssignees.length) p.assigneeId = selectedAssignees.join(',');
    if (selectedSprints.length) p.sprintId = selectedSprints.join(',');
    if (selectedPriorities.length) p.priority = selectedPriorities.join(',');
    if (plannedStartFrom) p.plannedStartFrom = plannedStartFrom.toISOString();
    if (plannedStartTo) p.plannedStartTo = plannedStartTo.toISOString();
    if (plannedEndFrom) p.plannedEndFrom = plannedEndFrom.toISOString();
    if (plannedEndTo) p.plannedEndTo = plannedEndTo.toISOString();
    if (overdue) p.overdue = 'true';
    if (search) p.search = search;
    return p;
  };

  const handleExport = async (useFilters: boolean) => {
    setExporting(true);
    try {
      await api.exportTasks(projectId, useFilters ? buildParams() : undefined);
      toast.success('Tasks exported');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSelectedStatuses([]);
    setSelectedAssignees([]);
    setSelectedSprints([]);
    setSelectedPriorities([]);
    setPlannedStartFrom(undefined);
    setPlannedStartTo(undefined);
    setPlannedEndFrom(undefined);
    setPlannedEndTo(undefined);
    setOverdue(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetFilters(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Tasks to Excel</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Search */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {(workflow?.statuses ?? []).map((ws) => (
                <label key={ws.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedStatuses.includes(ws.id)}
                    onCheckedChange={() => toggle(selectedStatuses, ws.id, setSelectedStatuses)}
                  />
                  <span className="size-2 rounded-full" style={{ backgroundColor: ws.color }} />
                  {ws.name}
                </label>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
            <div className="flex flex-col gap-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedPriorities.includes(opt.value)}
                    onCheckedChange={() => toggle(selectedPriorities, opt.value, setSelectedPriorities)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Assignee</Label>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedAssignees.includes(m.userId)}
                    onCheckedChange={() => toggle(selectedAssignees, m.userId, setSelectedAssignees)}
                  />
                  <span className="truncate">{m.user.name ?? m.user.username}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sprint */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Sprint</Label>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {sprints.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedSprints.includes(s.id)}
                    onCheckedChange={() => toggle(selectedSprints, s.id, setSelectedSprints)}
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Planned Start Date Range */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Planned Start</Label>
            <div className="flex flex-col gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedStartFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedStartFrom ? format(plannedStartFrom, 'PP') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedStartFrom} onSelect={setPlannedStartFrom} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedStartTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedStartTo ? format(plannedStartTo, 'PP') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedStartTo} onSelect={setPlannedStartTo} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Planned End Date Range */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Planned End</Label>
            <div className="flex flex-col gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedEndFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedEndFrom ? format(plannedEndFrom, 'PP') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedEndFrom} onSelect={setPlannedEndFrom} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedEndTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedEndTo ? format(plannedEndTo, 'PP') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedEndTo} onSelect={setPlannedEndTo} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Overdue */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={overdue} onCheckedChange={(c) => setOverdue(!!c)} />
              Only overdue tasks
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleExport(false)} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
            Export All
          </Button>
          <Button onClick={() => handleExport(true)} disabled={exporting || !hasFilters}>
            {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
            Export Filtered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/ExportTasksDialog.tsx
git commit -m "feat: add ExportTasksDialog component"
```

---

### Task 8: Frontend — ExportBugsDialog component

**Files:**
- Create: `apps/web/src/components/bugs/ExportBugsDialog.tsx`

- [ ] **Step 1: Create the ExportBugsDialog component**

```tsx
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useMembers } from '@/hooks/useMembers';
import { toast } from 'sonner';
import type { BugSeverity } from '@/lib/types';

const SEVERITY_OPTIONS: { value: BugSeverity; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

interface ExportBugsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ExportBugsDialog({ open, onOpenChange, projectId }: ExportBugsDialogProps) {
  const { data: workflow } = useWorkflow(projectId, 'BUG');
  const { data: members = [] } = useMembers(projectId);

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    const idx = arr.indexOf(val);
    if (idx >= 0) setter(arr.filter((_, i) => i !== idx));
    else setter([...arr, val]);
  };

  const hasFilters =
    selectedStatuses.length > 0 || selectedSeverities.length > 0 ||
    selectedAssignees.length > 0 || selectedReporters.length > 0 ||
    search !== '';

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (selectedStatuses.length) p.workflowStatusId = selectedStatuses.join(',');
    if (selectedSeverities.length) p.severity = selectedSeverities.join(',');
    if (selectedAssignees.length) p.assigneeId = selectedAssignees.join(',');
    if (selectedReporters.length) p.reporterId = selectedReporters.join(',');
    if (search) p.search = search;
    return p;
  };

  const handleExport = async (useFilters: boolean) => {
    setExporting(true);
    try {
      await api.exportBugs(projectId, useFilters ? buildParams() : undefined);
      toast.success('Bugs exported');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSelectedStatuses([]);
    setSelectedSeverities([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetFilters(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Bugs to Excel</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Search */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {(workflow?.statuses ?? []).map((ws) => (
                <label key={ws.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedStatuses.includes(ws.id)}
                    onCheckedChange={() => toggle(selectedStatuses, ws.id, setSelectedStatuses)}
                  />
                  <span className="size-2 rounded-full" style={{ backgroundColor: ws.color }} />
                  {ws.name}
                </label>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Severity</Label>
            <div className="flex flex-col gap-1">
              {SEVERITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedSeverities.includes(opt.value)}
                    onCheckedChange={() => toggle(selectedSeverities, opt.value, setSelectedSeverities)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Assignee</Label>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedAssignees.includes(m.userId)}
                    onCheckedChange={() => toggle(selectedAssignees, m.userId, setSelectedAssignees)}
                  />
                  <span className="truncate">{m.user.name ?? m.user.username}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Reporter */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Reporter</Label>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedReporters.includes(m.userId)}
                    onCheckedChange={() => toggle(selectedReporters, m.userId, setSelectedReporters)}
                  />
                  <span className="truncate">{m.user.name ?? m.user.username}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleExport(false)} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
            Export All
          </Button>
          <Button onClick={() => handleExport(true)} disabled={exporting || !hasFilters}>
            {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
            Export Filtered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bugs/ExportBugsDialog.tsx
git commit -m "feat: add ExportBugsDialog component"
```

---

### Task 9: Wire Export button into BacklogPage

**Files:**
- Modify: `apps/web/src/pages/BacklogPage.tsx`

- [ ] **Step 1: Add import for ExportTasksDialog**

Add this import at the top of `BacklogPage.tsx` alongside the other task component imports:

```typescript
import { ExportTasksDialog } from '@/components/tasks/ExportTasksDialog';
```

- [ ] **Step 2: Add state for the export dialog**

Add this state variable alongside the other `useState` declarations (near line 34):

```typescript
const [exportOpen, setExportOpen] = useState(false);
```

- [ ] **Step 3: Add the Export button in the header**

In both the empty-state render and the main render, add the Export button alongside the existing buttons. In the button group `<div className="flex items-center gap-2">`, add before the "Generate with AI" button:

```tsx
<Button variant="outline" onClick={() => setExportOpen(true)}>
  Export Excel
</Button>
```

- [ ] **Step 4: Render the ExportTasksDialog**

Add the dialog alongside the other dialogs (near the `CreateTaskDialog`):

```tsx
<ExportTasksDialog
  open={exportOpen}
  onOpenChange={setExportOpen}
  projectId={projectId}
/>
```

Add this in both the empty-state return and the main return.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/BacklogPage.tsx
git commit -m "feat: wire Export Excel button into BacklogPage"
```

---

### Task 10: Wire Export button into BugsPage

**Files:**
- Modify: `apps/web/src/pages/BugsPage.tsx`

- [ ] **Step 1: Add import for ExportBugsDialog**

Add this import at the top of `BugsPage.tsx`:

```typescript
import { ExportBugsDialog } from '@/components/bugs/ExportBugsDialog';
```

- [ ] **Step 2: Add state for the export dialog**

Add this state variable alongside the other `useState` declarations:

```typescript
const [exportOpen, setExportOpen] = useState(false);
```

- [ ] **Step 3: Add the Export button in the header**

In both the empty-state and main renders, in the button group `<div className="flex items-center gap-2">`, add before "Import from Excel":

```tsx
<Button variant="outline" onClick={() => setExportOpen(true)}>
  Export Excel
</Button>
```

- [ ] **Step 4: Render the ExportBugsDialog**

Add alongside the other dialogs:

```tsx
<ExportBugsDialog
  open={exportOpen}
  onOpenChange={setExportOpen}
  projectId={projectId}
/>
```

Add this in both the empty-state return and the main return.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/BugsPage.tsx
git commit -m "feat: wire Export Excel button into BugsPage"
```

---

### Task 11: Verify end-to-end

- [ ] **Step 1: Build the API**

```bash
cd apps/api && npm run build
```

Expected: no compile errors.

- [ ] **Step 2: Build the web app**

```bash
cd apps/web && npm run build
```

Expected: no compile errors.

- [ ] **Step 3: Verify TypeScript types**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no type errors.
