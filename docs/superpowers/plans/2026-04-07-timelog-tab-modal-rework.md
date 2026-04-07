# TimeLog Tab & Modal Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move time logs into a tab (Comments | Time Logs | Activity), replace inline sidebar inputs with Set Estimate and Log Time modals.

**Architecture:** Two new modal components (`SetEstimateModal`, `LogTimeModal`) using shadcn Dialog. `TimeTrackingCard` becomes read-only with trigger buttons. `TimeLogsList` relocates from standalone card into new tab. `LogTimeCard` is deleted.

**Tech Stack:** React, shadcn/ui Dialog, lucide-react icons, existing React Query hooks

---

### Task 1: Create SetEstimateModal

**Files:**
- Create: `apps/web/src/components/tasks/SetEstimateModal.tsx`

- [ ] **Step 1: Create SetEstimateModal component**

```tsx
// apps/web/src/components/tasks/SetEstimateModal.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SetEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEstimateMinutes: number | null;
  onSave: (minutes: number | null) => void;
}

export function SetEstimateModal({
  open,
  onOpenChange,
  currentEstimateMinutes,
  onSave,
}: SetEstimateModalProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');

  // Sync form with current estimate when modal opens
  useEffect(() => {
    if (open) {
      if (currentEstimateMinutes && currentEstimateMinutes > 0) {
        setHours(String(Math.floor(currentEstimateMinutes / 60) || ''));
        setMinutes(String(currentEstimateMinutes % 60 || ''));
      } else {
        setHours('');
        setMinutes('');
      }
    }
  }, [open, currentEstimateMinutes]);

  const handleSave = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const total = h * 60 + m;
    onSave(total > 0 ? total : null);
    onOpenChange(false);
  };

  const handleClear = () => {
    onSave(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Set Estimate</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 py-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Hours</label>
            <input
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Minutes</label>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to SetEstimateModal

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/SetEstimateModal.tsx
git commit -m "feat: add SetEstimateModal component"
```

---

### Task 2: Create LogTimeModal

**Files:**
- Create: `apps/web/src/components/tasks/LogTimeModal.tsx`

- [ ] **Step 1: Create LogTimeModal component**

```tsx
// apps/web/src/components/tasks/LogTimeModal.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface LogTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isLoading?: boolean;
}

export function LogTimeModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: LogTimeModalProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [comment, setComment] = useState('');
  const [loggedAt, setLoggedAt] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setHours('');
      setMinutes('');
      setComment('');
      setLoggedAt(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

  const handleSubmit = () => {
    if (totalMinutes <= 0) return;

    onSubmit({
      minutes: totalMinutes,
      comment: comment.trim() || undefined,
      loggedAt: loggedAt || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Hours</label>
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Minutes</label>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-[1.5]">
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <input
                type="date"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isLoading || totalMinutes <= 0}>
            {isLoading ? 'Logging...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to LogTimeModal

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/LogTimeModal.tsx
git commit -m "feat: add LogTimeModal component"
```

---

### Task 3: Update TimeTrackingCard to read-only with modal triggers

**Files:**
- Modify: `apps/web/src/components/tasks/TimeTrackingCard.tsx` (lines 1-113)

- [ ] **Step 1: Rewrite TimeTrackingCard**

Replace the entire file content with:

```tsx
// apps/web/src/components/tasks/TimeTrackingCard.tsx
import { useState } from 'react';
import { Pencil, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { formatMinutes, getTotalEstimated, getTotalLogged } from '../../lib/time-utils';
import type { Task } from '../../lib/types';
import { SetEstimateModal } from './SetEstimateModal';
import { LogTimeModal } from './LogTimeModal';

interface TimeTrackingCardProps {
  task: Task;
  onEstimateChange?: (minutes: number | null) => void;
  onLogTime?: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isParent: boolean;
  isLogTimeLoading?: boolean;
}

export function TimeTrackingCard({
  task,
  onEstimateChange,
  onLogTime,
  isParent,
  isLogTimeLoading,
}: TimeTrackingCardProps) {
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);
  const [logTimeModalOpen, setLogTimeModalOpen] = useState(false);

  const totalEstimated = getTotalEstimated(task);
  const totalLogged = getTotalLogged(task);
  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;
  const remaining = totalEstimated - totalLogged;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-semibold">Time Tracking</h4>

      {/* Estimate bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-blue-500">Estimate</span>
          <span className="text-muted-foreground">{formatMinutes(totalEstimated)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-blue-500 rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Actual bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className={isOverBudget ? 'text-red-500' : 'text-green-500'}>Actual</span>
          <span className={isOverBudget ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
            {formatMinutes(totalLogged)}
            {isOverBudget && ' \u26a0\ufe0f'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div
            className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Remaining / Over */}
      {totalEstimated > 0 && (
        <div className="flex justify-between text-xs border-t border-border pt-2">
          <span className={isOverBudget ? 'text-red-500' : 'text-muted-foreground'}>
            {isOverBudget ? 'Over by' : 'Remaining'}
          </span>
          <span className={isOverBudget ? 'text-red-500 font-semibold' : 'text-green-500'}>
            {formatMinutes(Math.abs(remaining))}
          </span>
        </div>
      )}

      {/* Action buttons — only for leaf tasks */}
      {!isParent && (
        <div className="flex gap-2 border-t border-border pt-2">
          {onEstimateChange && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 h-7 text-xs"
              onClick={() => setEstimateModalOpen(true)}
            >
              <Pencil className="size-3" />
              Set Estimate
            </Button>
          )}
          {onLogTime && (
            <Button
              size="sm"
              className="flex-1 gap-1.5 h-7 text-xs"
              onClick={() => setLogTimeModalOpen(true)}
            >
              <Clock className="size-3" />
              Log Time
            </Button>
          )}
        </div>
      )}

      {isParent && (
        <p className="text-xs text-muted-foreground italic">Auto-summed from sub-tasks</p>
      )}

      {/* Modals */}
      {onEstimateChange && (
        <SetEstimateModal
          open={estimateModalOpen}
          onOpenChange={setEstimateModalOpen}
          currentEstimateMinutes={task.estimatedMinutes ?? null}
          onSave={onEstimateChange}
        />
      )}
      {onLogTime && (
        <LogTimeModal
          open={logTimeModalOpen}
          onOpenChange={setLogTimeModalOpen}
          onSubmit={onLogTime}
          isLoading={isLogTimeLoading}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to TimeTrackingCard

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/TimeTrackingCard.tsx
git commit -m "refactor: make TimeTrackingCard read-only with modal trigger buttons"
```

---

### Task 4: Update TaskDetailPage — move Time Logs to tab, remove LogTimeCard, wire modals

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`
- Delete: `apps/web/src/components/tasks/LogTimeCard.tsx`

This task has three changes to TaskDetailPage:
1. Remove the standalone Time Logs card (lines 554-563)
2. Add Time Logs tab between Comments and Activity (lines 599-623)
3. Update sidebar: remove LogTimeCard, pass `onLogTime` to TimeTrackingCard (lines 812-830)

- [ ] **Step 1: Update imports in TaskDetailPage**

In `apps/web/src/pages/TaskDetailPage.tsx`, remove the `LogTimeCard` import and keep everything else.

Find this line:
```tsx
import { LogTimeCard } from '@/components/tasks/LogTimeCard';
```

Delete it entirely.

- [ ] **Step 2: Remove standalone Time Logs card from left panel**

Find and remove this entire block (lines 554-563):

```tsx
          {/* Time Logs Section */}
          <div className="rounded-lg border p-5">
            <TimeLogsList
              timeLogs={task.timeLogs ?? []}
              currentUserId={currentUserId}
              userRole={canManage ? 'pm' : ''}
              onDelete={(timeLogId) => deleteTimeLog.mutate({ taskId: task.id, timeLogId })}
              isDeleting={deleteTimeLog.isPending}
            />
          </div>
```

- [ ] **Step 3: Add Time Logs tab between Comments and Activity**

Find the existing tabs block:
```tsx
            <Tabs defaultValue="comments">
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
```

Replace with:
```tsx
            <Tabs defaultValue="comments">
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="timelogs">Time Logs</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
```

Then find:
```tsx
              <TabsContent value="activity">
```

Insert before it:
```tsx
              <TabsContent value="timelogs">
                <TimeLogsList
                  timeLogs={task.timeLogs ?? []}
                  currentUserId={currentUserId}
                  userRole={canManage ? 'pm' : ''}
                  onDelete={(timeLogId) => deleteTimeLog.mutate({ taskId: task.id, timeLogId })}
                  isDeleting={deleteTimeLog.isPending}
                />
              </TabsContent>
```

- [ ] **Step 4: Update sidebar — replace LogTimeCard with onLogTime prop on TimeTrackingCard**

Find the sidebar time tracking block (lines 812-830):
```tsx
              {/* Time Tracking */}
              <TimeTrackingCard
                task={task}
                isParent={isParent}
                onEstimateChange={!isParent ? (minutes) => {
                  updateTask.mutate({
                    taskId: task.id,
                    data: { estimatedMinutes: minutes },
                  });
                } : undefined}
              />

              {/* Log Time — only for leaf tasks */}
              {!isParent && (
                <LogTimeCard
                  onSubmit={(data) => createTimeLog.mutate({ taskId: task.id, data })}
                  isLoading={createTimeLog.isPending}
                />
              )}
```

Replace with:
```tsx
              {/* Time Tracking */}
              <TimeTrackingCard
                task={task}
                isParent={isParent}
                onEstimateChange={!isParent ? (minutes) => {
                  updateTask.mutate({
                    taskId: task.id,
                    data: { estimatedMinutes: minutes },
                  });
                } : undefined}
                onLogTime={!isParent ? (data) => {
                  createTimeLog.mutate({ taskId: task.id, data });
                } : undefined}
                isLogTimeLoading={createTimeLog.isPending}
              />
```

- [ ] **Step 5: Delete LogTimeCard**

```bash
rm apps/web/src/components/tasks/LogTimeCard.tsx
```

- [ ] **Step 6: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors. No references to LogTimeCard remain.

- [ ] **Step 7: Verify no dangling imports**

Run: `grep -r "LogTimeCard" apps/web/src/`
Expected: No results

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/src/pages/TaskDetailPage.tsx apps/web/src/components/tasks/LogTimeCard.tsx
git commit -m "feat: move time logs to tab, replace inline forms with modal triggers

- Add Time Logs tab between Comments and Activity
- Remove standalone Time Logs card from left panel
- Remove LogTimeCard from sidebar, wire modals via TimeTrackingCard
- Delete LogTimeCard component (replaced by LogTimeModal)"
```

---

### Task 5: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Open a leaf task detail page and verify:**

1. **Tabs** show: Comments | Time Logs | Activity (in that order)
2. **Time Logs tab** shows the list of time log entries with delete buttons
3. **Right sidebar** shows TimeTrackingCard with progress bars (read-only, no inline inputs)
4. **"Set Estimate" button** in sidebar opens modal, pre-fills current estimate, saving updates the bars
5. **"Log Time" button** in sidebar opens modal, submitting adds entry to Time Logs tab
6. **"Clear" button** in estimate modal clears the estimate

- [ ] **Step 3: Open a parent task detail page and verify:**

1. TimeTrackingCard shows "Auto-summed from sub-tasks" text
2. No "Set Estimate" or "Log Time" buttons appear
3. Time Logs tab still works (shows child time logs if any)

- [ ] **Step 4: Commit verification note**

No commit needed — this is a manual check.
