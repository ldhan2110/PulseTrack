# TimeLog Tab & Modal Rework Design

**Date**: 2026-04-07
**Status**: Approved

## Overview

Rework the task detail page to:
1. Add "Time Logs" as a tab between Comments and Activity (tab order: Comments | Time Logs | Activity)
2. Replace inline estimate input and LogTimeCard in the right sidebar with two modal popups (Set Estimate, Log Time)
3. Keep TimeTrackingCard progress bars in the sidebar as read-only summary

## Current State

- **Left panel**: Standalone "Time Logs" card showing `TimeLogsList`
- **Right sidebar**: `TimeTrackingCard` with inline "Set Estimate" input + `LogTimeCard` form
- **Tabs**: Comments | Activity

## Target State

- **Left panel**: Standalone Time Logs card removed
- **Right sidebar**: `TimeTrackingCard` read-only progress bars + "Set Estimate" button + "Log Time" button
- **Tabs**: Comments | Time Logs | Activity

## Detailed Design

### 1. Tab Restructure

Reorder the existing `<Tabs>` in TaskDetailPage from `Comments | Activity` to `Comments | Time Logs | Activity`.

- Add a new `TabsTrigger` with value `"timelogs"` between Comments and Activity
- Add a new `TabsContent` rendering `TimeLogsList` with the same props currently used in the standalone card
- Remove the standalone "Time Logs" card from the left panel
- Default tab remains `"comments"`

### 2. Right Sidebar — TimeTrackingCard (Read-Only + Buttons)

Make `TimeTrackingCard` read-only and add modal trigger buttons:

- Remove the inline "Set Estimate" hours/minutes input fields from `TimeTrackingCard`
- Keep the estimate vs actual progress bars unchanged
- Add two buttons below the progress bars (inside `TimeTrackingCard`):
  - **"Set Estimate"** — outline variant, pencil icon (`Pencil` from lucide-react), opens `SetEstimateModal`
  - **"Log Time"** — default/primary variant, clock icon (`Clock` from lucide-react), opens `LogTimeModal`
- Both buttons are only rendered for **leaf tasks** (not parent tasks that auto-sum from children)
- Button row uses `flex gap-2` layout

New props for `TimeTrackingCard`:
```typescript
interface TimeTrackingCardProps {
  task: Task;
  onEstimateChange?: (minutes: number | null) => void;
  onLogTime?: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isParent: boolean;
  isEstimateLoading?: boolean;
  isLogTimeLoading?: boolean;
}
```

### 3. SetEstimateModal

New file: `apps/web/src/components/tasks/SetEstimateModal.tsx`

- Uses shadcn `Dialog` component
- **Title**: "Set Estimate"
- **Fields**:
  - Hours input — `type="number"`, min 0, label "Hours"
  - Minutes input — `type="number"`, min 0, max 59, label "Minutes"
  - Pre-filled with current estimate (converted from `estimatedMinutes` to h/m) if one exists
- **Footer buttons**:
  - "Clear" (destructive variant, left-aligned) — sets estimate to `null`
  - "Cancel" (outline variant) — closes modal
  - "Save" (default variant) — saves the estimate
- **On save**: converts hours + minutes to total minutes, calls `onEstimateChange(totalMinutes)`
- **On clear**: calls `onEstimateChange(null)`
- Modal closes on save/clear/cancel

```typescript
interface SetEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEstimateMinutes: number | null;
  onSave: (minutes: number | null) => void;
}
```

### 4. LogTimeModal

New file: `apps/web/src/components/tasks/LogTimeModal.tsx`

- Uses shadcn `Dialog` component
- **Title**: "Log Time"
- **Fields**:
  - Hours input — `type="number"`, min 0, label "Hours"
  - Minutes input — `type="number"`, min 0, max 59, label "Minutes"
  - Date picker — defaults to today, label "Date"
  - Comment textarea — optional, label "Comment", placeholder "What did you work on?"
- **Footer buttons**:
  - "Cancel" (outline variant) — closes modal
  - "Submit" (default variant) — submits the time log
- **Validation**: total minutes must be > 0 (disable Submit button if 0)
- **On submit**: calls `onSubmit({ minutes, comment, loggedAt })`, same shape as current `LogTimeCard`
- Modal closes on submit/cancel
- Form resets on close

```typescript
interface LogTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isLoading?: boolean;
}
```

### 5. LogTimeCard Removal

- Delete `apps/web/src/components/tasks/LogTimeCard.tsx`
- Remove its import and usage from `TaskDetailPage.tsx`
- Functionality is fully replaced by `LogTimeModal`

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `TaskDetailPage.tsx` | Modify | Remove standalone Time Logs card, add Time Logs tab, remove LogTimeCard from sidebar, wire modal callbacks |
| `TimeTrackingCard.tsx` | Modify | Remove inline estimate input, add Set Estimate + Log Time buttons, manage modal open state |
| `SetEstimateModal.tsx` | Create | Estimate input modal with hours/minutes fields |
| `LogTimeModal.tsx` | Create | Time logging modal with hours/minutes, date, comment |
| `LogTimeCard.tsx` | Delete | Replaced by LogTimeModal |

## Unchanged

- `TimeLogsList.tsx` — reused as-is, just relocated into tab
- `ActivityLog.tsx`, `ActivityEntry.tsx` — unchanged
- `CommentThread.tsx`, `CommentItem.tsx`, `CommentComposer.tsx` — unchanged
- All backend APIs, hooks, types — unchanged
