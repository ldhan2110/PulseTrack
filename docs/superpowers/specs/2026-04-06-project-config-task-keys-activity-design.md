# Design: Project Config, Task Keys, Comment Editing & Activity Feed

**Date:** 2026-04-06
**Status:** Approved

## Overview

Four interconnected features that improve project identity, task traceability, comment workflows, and activity visibility:

1. **Project Settings Page** - Configure project avatar and task key prefix
2. **Task Key System** - JIRA-style sequential task numbering (`PM-1`, `PM-42`)
3. **Comment Editing** - Edit comments with "(edited)" indicator
4. **Activity Feed Redesign** - Comprehensive, reverse-chronological activity timeline with rich diffs

A key change: **URLs switch from CUID to human-readable slugs** using the project prefix and task key.

---

## 1. Schema Changes

### Project Model Additions

```prisma
model Project {
  // ... existing fields ...
  prefix    String    @unique   // 2-10 uppercase letters, e.g. "PM", "ACME"
  taskSeq   Int       @default(0) // Auto-incrementing counter for task keys
  avatarUrl String?   // Path to uploaded avatar image
}
```

- `prefix` serves dual purpose: task key prefix AND URL slug
- `prefix` is unique across all projects
- `prefix` is validated: 2-10 uppercase letters only (`/^[A-Z]{2,10}$/`)
- `taskSeq` is atomically incremented on each task creation

### Task Model Additions

```prisma
model Task {
  // ... existing fields ...
  taskKey   String    @unique   // e.g. "PM-1", "ACME-42"
}
```

- `taskKey` is computed on creation: `{project.prefix}-{++project.taskSeq}`
- Immutable after creation (prefix changes don't retroactively rename keys)

### Comment Model Additions

```prisma
model Comment {
  // ... existing fields ...
  isEdited  Boolean   @default(false)
}
```

### TaskHistory Expanded Field Values

The existing `field` column (String) gains new tracked event types:

| field value | oldValue | newValue | Trigger |
|---|---|---|---|
| `comment_added` | null | Content snippet (first 200 chars, HTML stripped) | Comment created |
| `comment_edited` | Previous content (HTML stripped, 500 chars) | New content (HTML stripped, 500 chars) | Comment updated |
| `comment_deleted` | Deleted content (HTML stripped, 200 chars) | null | Comment deleted |
| `description` | Previous description (500 chars) | New description (500 chars) | Task description updated |
| `acceptanceCriteria` | Previous criteria JSON | New criteria JSON | Criteria added/removed/changed |
| `attachment_added` | null | Filename | Attachment uploaded |
| `attachment_deleted` | Filename | null | Attachment removed |

Existing tracked fields remain unchanged: `status`, `assigneeId`, `sprintId`, `storyPoints`, `title`.

---

## 2. URL Restructuring

### Before → After

| Page | Before | After |
|---|---|---|
| Project dashboard | `/projects/clxyz123abc/dashboard` | `/projects/PM/dashboard` |
| Backlog | `/projects/clxyz123abc/backlog` | `/projects/PM/backlog` |
| Task detail | `/projects/clxyz123abc/tasks/clxyz456def` | `/projects/PM/tasks/PM-42` |
| Settings (new) | N/A | `/projects/PM/settings` |

### Implementation

- **Frontend routes**: Change params from `:projectId` to `:projectPrefix`
- **API endpoints**: Resolve projects by `prefix` instead of `id`, tasks by `taskKey` instead of `id`
- **API route pattern**: `/projects/:prefix/tasks/:taskKey/...`
- **All internal links**: Navigation, breadcrumbs, React Query keys update to use prefix/taskKey
- **API client**: Lookup functions change signature from `(projectId)` to `(projectPrefix)`

### Migration

- Existing projects must set a prefix before the new routes activate
- Auto-generate a suggested prefix from project name (first letters, uppercase)
- Backfill `taskKey` for existing tasks based on creation order (`ORDER BY createdAt ASC`)

---

## 3. Project Settings Page

### Route & Access

- **Route**: `/projects/:projectPrefix/settings`
- **Sidebar**: Gear icon at bottom of project nav, labeled "Settings"
- **Access**: PM role only (consistent with project management permissions)

### Sections

#### Avatar Upload
- Drag-and-drop zone or click-to-browse
- Preview of current avatar (circular crop)
- Accepted formats: PNG, JPG, WebP (max 2MB)
- Stored via existing attachment upload infrastructure
- Avatar displays in project sidebar header and project list

#### Task Key Prefix
- Text input, auto-uppercased
- Validation: 2-10 uppercase letters, unique across projects
- Real-time uniqueness check (debounced API call)
- Preview: "Tasks will be numbered: {PREFIX}-1, {PREFIX}-2, ..."
- Warning if project already has tasks: "Existing task keys will not be renamed"

#### General Info
- Project name (text input)
- Project description (text area)

---

## 4. Comment Editing

### User Flow
1. User hovers over their own comment → "Edit" button appears (pencil icon, alongside Reply/Delete)
2. Click Edit → comment content area transforms into Tiptap editor pre-filled with existing content
3. Save/Cancel buttons appear below editor
4. On Save:
   - Comment content updated in DB
   - `isEdited` set to `true`
   - TaskHistory entry created: `field: "comment_edited"`, oldValue/newValue with stripped content
5. "(edited)" tag appears next to timestamp in muted text

### Permissions
- Authors can edit their own comments
- PM/BA with `canManage` can edit any comment (consistent with delete permissions)

### API

```
PATCH /projects/:prefix/tasks/:taskKey/comments/:commentId
Body: { content: string }
Response: Updated comment with isEdited: true
```

---

## 5. Activity Feed Redesign

### Data & Sorting
- **Sort order**: Descending (latest first) — reverse of current ascending
- **Single endpoint**: `GET /projects/:prefix/tasks/:taskKey/history` returns all activity types
- **Includes**: All TaskHistory entries (existing field changes + new comment/description/attachment/criteria events)

### Visual Design

#### Timeline Structure
- **Icon-based timeline dots**: Each event type gets a distinct icon in a small colored circle
  - Status change: `ArrowRight` (blue)
  - Assignee change: `UserCheck` (violet)
  - Sprint change: `Milestone` (orange)
  - Story points: `Star` (amber)
  - Title renamed: `Pencil` (gray)
  - Comment added: `MessageSquare` (green)
  - Comment edited: `MessageSquarePen` (yellow)
  - Comment deleted: `MessageSquareX` (red)
  - Description changed: `FileText` (indigo)
  - Criteria changed: `ListChecks` (teal)
  - Attachment added: `Paperclip` (sky)
  - Attachment deleted: `Paperclip` (red)

- **Vertical connecting line**: Clean line through center of icon dots (not an offset border-l)
- **Actor + action sentence**: `"{username} {action}"` with right-aligned relative timestamp

#### Date Grouping
- Entries grouped by date: "Today", "Yesterday", or formatted date (e.g. "Apr 5, 2026")
- Date header as a subtle divider between groups

#### Rich Content Cards
- For entries with before/after values: compact diff card with subtle background
  - Old value: muted text with strikethrough or red-tinted background
  - New value: normal text or green-tinted background
- Comment snippets: quoted block style with truncation
- Simple field changes (status, assignee): inline text, no card needed

---

## 6. Backend API Changes Summary

### New Endpoints
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/projects/:prefix` | Get project by prefix |
| `PATCH` | `/projects/:prefix/settings` | Update project settings (prefix, name, description) |
| `POST` | `/projects/:prefix/avatar` | Upload project avatar |
| `DELETE` | `/projects/:prefix/avatar` | Remove project avatar |
| `PATCH` | `/projects/:prefix/tasks/:taskKey/comments/:id` | Edit comment |

### Modified Endpoints
All existing `/projects/:id/...` endpoints change to `/projects/:prefix/...`:
- Tasks resolved by `taskKey` instead of task `id`
- Projects resolved by `prefix` instead of `id`

### Task Creation Flow Change
1. Client sends `POST /projects/:prefix/tasks` with title, etc.
2. Server atomically: increment `project.taskSeq`, compute `taskKey = "{prefix}-{newSeq}"`, create task
3. Use Prisma `$transaction` to prevent race conditions on seq increment

---

## 7. Frontend Component Changes Summary

### New Components
- `ProjectSettingsPage` - Settings page with avatar upload, prefix config, general info
- `ActivityIcon` - Icon dot component for timeline (maps event type → icon + color)
- `ActivityDiffCard` - Before/after diff display card
- `DateGroupHeader` - Date separator for activity timeline

### Modified Components
- `ActivityLog` - Redesigned with icon timeline, date grouping, desc sort
- `ActivityEntry` - Redesigned with icons, rich descriptions, diff cards
- `CommentItem` - Add edit button, "(edited)" tag, inline editor mode
- `CommentThread` - Wire up edit handler
- `CreateTaskDialog` - Display generated task key after creation
- `App.tsx` - Route params change to `:projectPrefix`, add settings route
- `Sidebar/Nav` - Add settings link, display project avatar
- All link/navigation components - Use prefix/taskKey in URLs

### Modified Hooks
- `useTaskHistory` - Update to use prefix/taskKey params
- `useComments` - Add `updateComment` mutation
- `useTasks` - Update to use prefix/taskKey
- `useProjects` - Add settings update mutation, avatar upload mutation
- API client (`api.ts`) - All project/task functions use prefix/taskKey

---

## 8. Migration Plan

### Database Migration Steps
1. Add `prefix` (nullable initially), `taskSeq`, `avatarUrl` to Project
2. Add `taskKey` (nullable initially) to Task
3. Add `isEdited` to Comment
4. Run data migration script:
   - For each project: generate prefix from name, set `taskSeq` based on task count
   - For each task (ordered by `createdAt`): assign sequential `taskKey`
5. Make `prefix` and `taskKey` non-nullable, add unique constraints
6. Update API endpoints to resolve by prefix/taskKey

### Rollout
- Single migration + deploy since this is a POC
- No backwards-compatible dual-routing needed
