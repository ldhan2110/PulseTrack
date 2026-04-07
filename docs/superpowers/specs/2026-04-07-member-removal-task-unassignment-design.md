# Member Removal Task Unassignment

**Date:** 2026-04-07
**Status:** Approved

## Problem

When a project member is removed, their assigned Tasks, SubTasks, and Bugs remain assigned to them, creating orphaned assignments. The removed user is no longer a project member but still appears as the assignee on active work items.

## Requirements

- On member removal, unassign all active work items (Tasks, SubTasks, Bugs) from the removed member
- Preserve the assignee on completed work items for historical record
- Notify project PMs when items are bulk-unassigned so they can reassign
- Show the PM a count of affected items before confirming removal

## Status Definitions

**Unassign** (set `assigneeId = null`):
- Tasks: `BACKLOG`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`
- SubTasks: `BACKLOG`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`
- Bugs: `OPEN`, `IN_PROGRESS`, `REOPENED`

**Keep assignee** (no change):
- Tasks: `DONE`
- SubTasks: `DONE`
- Bugs: `RESOLVED`, `CLOSED`

## Design

### 1. Backend: Transactional Member Removal

`MembersService.removeMember()` wraps all operations in a single Prisma `$transaction`:

1. **Query affected items** -- find all Tasks, SubTasks, and Bugs in the project where `assigneeId` matches the removed member's `userId` and status is not in the "keep" set above.

2. **Bulk unassign** -- `updateMany` setting `assigneeId = null` for each entity type (Tasks, SubTasks, Bugs).

3. **Record history** -- create `TaskHistory` entries for each unassigned Task with:
   - `field`: `"assigneeId"`
   - `oldValue`: removed member's userId
   - `newValue`: `null`
   - `actorId`: the PM performing the removal

4. **Delete ProjectMember** -- same as current logic.

5. **Post-transaction** -- notify PMs with a summary and emit Socket.IO events to refresh boards.

### 2. Backend: Pre-Removal Active Work Count Endpoint

**`GET /projects/:projectId/members/:memberId/active-work`**

Returns the count of active items assigned to this member:

```json
{
  "tasks": 5,
  "subTasks": 2,
  "bugs": 1
}
```

- Same status filters as Section 1 (excludes completed/resolved/closed items)
- Protected by `@ProjectRoles('pm')`
- Used by the frontend confirmation dialog

### 3. Frontend: Enhanced Removal Confirmation Dialog

When PM clicks "Remove" on a member:

1. **Fetch active work count** via the new endpoint before showing the dialog.
2. **Dialog content:**
   - If all counts are zero: "Are you sure you want to remove {name}?"
   - If any count > 0: "Removing {name} will unassign **{N} tasks**, **{N} subtasks**, and **{N} bugs** currently assigned to them. These items will become unassigned. Continue?"
   - Only mention entity types with count > 0 (e.g., omit "0 bugs").
3. Confirm/Cancel buttons remain the same.

Post-removal, React Query invalidation happens via existing Socket.IO events.

### 4. PM Notifications

After the transaction, notify all PMs in the project (excluding the PM who performed the removal):

- **Event type:** `member:removed:tasks-unassigned`
- **Payload:** `{ memberName, tasks, subTasks, bugs, projectId }`
- **Display:** "{memberName} was removed. {N} tasks, {N} subtasks, and {N} bugs were unassigned and need reassignment."
- Only sent if at least one item was unassigned.

## Affected Files

### Backend
- `apps/api/src/members/members.service.ts` -- add transaction logic, active work query
- `apps/api/src/members/members.controller.ts` -- add active-work endpoint
- `apps/api/src/notifications/notifications.service.ts` -- add new notification event type
- `apps/api/src/notifications/notifications.gateway.ts` -- handle new event emission

### Frontend
- `apps/web/src/components/members/MembersTable.tsx` -- enhanced confirmation dialog
- `apps/web/src/hooks/useMembers.ts` -- add `useActiveWork` query hook

## Approach

**Approach A: Backend-only cascade** -- all unassignment logic runs inside `MembersService.removeMember()` in a single Prisma transaction. Chosen over event-driven (race conditions) and database triggers (logic hidden from app layer, no notifications/history).
