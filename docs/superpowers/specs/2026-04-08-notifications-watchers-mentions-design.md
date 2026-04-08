# Notifications, Watchers & @Mentions Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Persistent notification system, ticket watchers (tasks + bugs), @mentions in comments, email notifications, bug comments

---

## Overview

Add a complete notification system to PulseTrack: users can watch tasks/bugs via a multi-select watcher field, @mention project members in comments, receive in-app and email notifications, and manage notifications through a bell dropdown and full notifications page. Bugs also gain their own comment system by making the Comment model polymorphic.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| @mention adds to watchers? | No — notification only | Keep watchers intentional; mentions are one-time pings |
| Notification preferences | All-or-nothing per watcher | Simplest for POC; per-event muting can be layered later |
| Email delivery | Always (in-app + email) | When project has email enabled; queued via BullMQ for concurrency |
| Email config | Global SMTP via env vars | Per-project toggle to enable/disable; no per-project SMTP config |
| Bug comments | Polymorphic Comment model | Reuse existing Comment with nullable taskId + bugId |
| Auto-watching | None | Watchers are purely explicit via multi-select field |
| Notification UI | Bell dropdown + full page | Dropdown for recent 10; /notifications page for full history |

---

## 1. Data Model

### 1.1 New Enums

```prisma
enum NotificationType {
  STATUS_CHANGE
  ASSIGNEE_CHANGE
  COMMENT_ADDED
  COMMENT_EDITED
  COMMENT_DELETED
  ATTACHMENT_CHANGE
  CRITERIA_CHANGE
  SUBTASK_CHANGE
  DESCRIPTION_EDIT
  SPRINT_CHANGE
  PRIORITY_CHANGE
  TICKET_DELETED
  MENTION
}

enum EntityType {
  TASK
  BUG
}
```

### 1.2 Notification Model

```prisma
model Notification {
  id          String           @id @default(cuid())
  recipientId String
  projectId   String
  type        NotificationType
  entityType  EntityType
  entityId    String
  entityTitle String           // Denormalized for display (e.g. "PM-42: Fix login bug")
  actorId     String
  summary     String           // Human-readable: "John changed status to In Progress"
  metadata    Json?            // { field, oldValue, newValue } for detail
  isRead      Boolean          @default(false)
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  recipient User    @relation("NotificationRecipient", fields: [recipientId], references: [id])
  actor     User    @relation("NotificationActor", fields: [actorId], references: [id])
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([recipientId, isRead, createdAt])
  @@index([recipientId, createdAt])
}
```

### 1.3 TicketWatcher Model

```prisma
model TicketWatcher {
  id         String     @id @default(cuid())
  entityType EntityType
  entityId   String
  userId     String
  createdAt  DateTime   @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([entityType, entityId, userId])
  @@index([entityType, entityId])
}
```

### 1.4 Comment Model Update (Polymorphic)

```prisma
model Comment {
  id        String    @id @default(cuid())
  content   String
  taskId    String?   // Nullable — one of taskId/bugId must be set
  bugId     String?   // New — nullable
  authorId  String
  parentId  String?
  isEdited  Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  task    Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  bug     Bug?     @relation(fields: [bugId], references: [id], onDelete: Cascade)
  author  User     @relation(fields: [authorId], references: [id])
  parent  Comment? @relation("CommentThread", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  replies Comment[] @relation("CommentThread")
}
```

Backend validation: reject if both `taskId` and `bugId` are null, or both are set.

### 1.5 Project Model Update

Add to `Project`:

```prisma
emailNotificationsEnabled Boolean @default(false)
```

### 1.6 User Model Updates

Add relations to `User`:

```prisma
notifications       Notification[] @relation("NotificationRecipient")
actedNotifications  Notification[] @relation("NotificationActor")
ticketWatches       TicketWatcher[]
```

### 1.7 Bug Model Update

Add relation to `Bug`:

```prisma
comments Comment[]
```

---

## 2. @Mention System

### 2.1 Frontend — TipTap Mention Extension

- Add `@tiptap/extension-mention` to `CommentComposer`
- When user types `@`, a suggestion dropdown appears listing project members
- Members are filtered as the user types (fuzzy match on name/username)
- Selecting a member inserts a mention node into the editor
- Rendered HTML: `<span data-mention-id="userId" class="mention">@Display Name</span>`

### 2.2 Member Lookup

- Reuse existing `GET /projects/:projectId/members` endpoint
- Already cached via React Query in the frontend
- The mention suggestion component queries this data client-side

### 2.3 Backend Extraction

When a comment is created or updated:

1. Parse the HTML content for `data-mention-id` attributes
2. Extract unique user IDs
3. For each mentioned user (excluding the comment author):
   - Create a `Notification` with type `MENTION`
4. On comment update: diff old vs new mentions, only notify newly added mentions

### 2.4 Frontend Rendering

- `CommentItem` already renders HTML via `DOMPurify.sanitize()`
- Add `data-mention-id` to DOMPurify's allowed attributes
- Style `.mention` spans with a highlighted background (e.g. `bg-blue-100 text-blue-800 rounded px-1`)

---

## 3. Watcher System

### 3.1 Watcher Field UI

- Multi-select dropdown in the task/bug detail sidebar
- Shows all project members (avatar + name)
- Selected members are displayed as avatar chips
- Quick "Watch/Unwatch" eye icon button for the current user to toggle themselves

### 3.2 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:projectId/tasks/:taskId/watchers` | List watchers |
| `POST` | `/projects/:projectId/tasks/:taskId/watchers` | Add watcher(s) — body: `{ userIds: string[] }` |
| `DELETE` | `/projects/:projectId/tasks/:taskId/watchers/:userId` | Remove watcher |
| `GET` | `/projects/:projectId/bugs/:bugId/watchers` | List watchers |
| `POST` | `/projects/:projectId/bugs/:bugId/watchers` | Add watcher(s) |
| `DELETE` | `/projects/:projectId/bugs/:bugId/watchers/:userId` | Remove watcher |

### 3.3 Notification Trigger Events

When any of these events occur, the service:
1. Queries `TicketWatcher` for the entity
2. Creates a `Notification` for each watcher (excluding the actor)
3. Pushes via Socket.IO
4. Enqueues email jobs if project has email enabled

**Events that notify watchers:**

| Event | NotificationType | Summary format |
|-------|-----------------|----------------|
| Status change | `STATUS_CHANGE` | "{actor} changed status from {old} to {new}" |
| Assignee change | `ASSIGNEE_CHANGE` | "{actor} assigned to {assignee}" |
| New comment | `COMMENT_ADDED` | "{actor} commented: {preview}" |
| Comment edited | `COMMENT_EDITED` | "{actor} edited a comment" |
| Comment deleted | `COMMENT_DELETED` | "{actor} deleted a comment" |
| Attachment upload/delete | `ATTACHMENT_CHANGE` | "{actor} added/removed attachment {filename}" |
| Criteria add/update/delete | `CRITERIA_CHANGE` | "{actor} updated acceptance criteria" |
| Sub-task add/update/delete | `SUBTASK_CHANGE` | "{actor} added/updated/removed sub-task {title}" |
| Description edit | `DESCRIPTION_EDIT` | "{actor} updated the description" |
| Sprint change | `SPRINT_CHANGE` | "{actor} moved to sprint {name}" |
| Priority change | `PRIORITY_CHANGE` | "{actor} changed priority from {old} to {new}" |
| Ticket deleted | `TICKET_DELETED` | "{actor} deleted {taskKey}: {title}" |

---

## 4. Notification Pipeline

### 4.1 In-App Flow

```
Event occurs (e.g. TasksService.update)
  → NotificationsService.createNotifications({ projectId, entityType, entityId, type, actorId, summary, metadata })
    → Query TicketWatcher for entity → get recipient IDs
    → Bulk insert Notification records (Prisma createMany)
    → For each recipient: NotificationsService.notifyUser(userId, 'notification:new', notification)
    → Frontend receives Socket.IO event → invalidates ['notifications'] and ['notification-count'] queries
    → Sonner toast shown for @mentions
```

### 4.2 Email Flow (BullMQ)

```
After creating notifications (if project.emailNotificationsEnabled === true):
  → For each notification: queue.add('notification-email', { notificationId, recipientId })
  → BullMQ worker picks up job
    → Load notification + recipient + actor from DB
    → Render HTML email from template
    → Send via Nodemailer (SMTP from env vars)
    → Retry with exponential backoff on failure (3 attempts)
```

**Concurrency controls:**
- BullMQ worker concurrency: 5 (configurable via env var)
- Rate limit: configurable per SMTP server capacity
- Bulk insert notifications in a single transaction
- Notification creation is async (fire-and-forget after main response)

### 4.3 SMTP Configuration

Environment variables:

```
SMTP_HOST=mail.company.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=pulsetrack@company.com
SMTP_PASS=secret
SMTP_FROM="PulseTrack <pulsetrack@company.com>"
```

No per-project SMTP config. Projects only toggle `emailNotificationsEnabled`.

---

## 5. Email Template

Jira-style HTML email with PulseTrack branding:

```
┌─────────────────────────────────────────────┐
│  Subject: [PM-42] Fix login bug             │
├─────────────────────────────────────────────┤
│                                             │
│  [Avatar] John Smith changed status         │
│  from "To Do" → "In Progress"              │
│                                             │
│  ─────────────────────────────────────      │
│                                             │
│  Comment by Jane Doe:                       │
│  "The API integration is ready for review"  │
│                                             │
│  ─────────────────────────────────────      │
│                                             │
│  [View in PulseTrack →]                     │
│                                             │
│  You are receiving this because you are     │
│  watching this ticket.                      │
│                                             │
├─────────────────────────────────────────────┤
│  [PulseTrack Icon] PulseTrack               │
└─────────────────────────────────────────────┘
```

**Template details:**
- Subject line: `[{taskKey}] {entityTitle}`
- Body: actor avatar/name, action summary, optional comment preview
- CTA button: "View in PulseTrack" linking to the task/bug detail page
- Footer: PulseTrack icon + "PulseTrack" app name, plus "You are receiving this because you are watching this ticket" / "you were mentioned in a comment"
- Responsive HTML — works in Outlook, Gmail, Apple Mail

---

## 6. Notification UI

### 6.1 Bell Icon (Header)

- Bell icon in the app header bar
- Red badge with unread count (hidden when 0)
- Click opens a dropdown panel

### 6.2 Dropdown Panel

- Shows the latest ~10 notifications
- Each row: actor avatar, summary text, relative time, blue dot for unread
- Click a notification → navigates to the task/bug detail page, marks as read
- "Mark all as read" button at the top
- "View all notifications" link at the bottom → `/notifications`

### 6.3 Full Notifications Page (`/notifications`)

- Paginated list (20 per page)
- Filter tabs: All / Unread
- Filter by type dropdown: All types, Comments, Status changes, Mentions, etc.
- Each row: avatar, summary, entity link, timestamp, read/unread indicator
- Click row → navigate to entity, mark as read
- Bulk "mark as read" for visible items

### 6.4 Real-Time Updates

- Socket.IO event `notification:new` pushes new notifications
- React Query invalidates `['notifications']` and `['notification-count']`
- Sonner toast for @mentions: "@John mentioned you in PM-42"

---

## 7. Notification API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications` | List notifications for current user (paginated, filterable) |
| `GET` | `/notifications/count` | Get unread count |
| `PATCH` | `/notifications/:id/read` | Mark single notification as read |
| `PATCH` | `/notifications/read-all` | Mark all as read for current user |

**Query params for `GET /notifications`:**
- `page` (default 1)
- `limit` (default 20)
- `isRead` (boolean filter, optional)
- `type` (NotificationType filter, optional)

---

## 8. Bug Comments

### 8.1 Backend

- Comment model updated with nullable `bugId` (see Section 1.4)
- New controller: `BugCommentsController` at `/projects/:projectId/bugs/:bugId/comments`
- Same operations: list, create, create reply, update, delete
- CommentsService updated to accept `bugId` as an alternative to `taskId`
- TaskHistory equivalent not needed for bugs (notifications cover the tracking)

### 8.2 Frontend

- Reuse `CommentThread`, `CommentComposer`, `CommentItem` components
- `useComments` hook updated to accept `{ taskId }` or `{ bugId }` parameter
- `BugDetailPage` adds a Comments tab using the same components
- @mention support works identically in bug comments

---

## 9. Project Settings

### 9.1 Email Notification Toggle

- Add to the existing project Settings page (alongside workflow settings)
- Single toggle: "Enable email notifications"
- When enabled: all notification events also send emails to watchers/mentioned users
- When disabled: in-app notifications only

---

## 10. Backend Module Structure

### New Modules

- **WatchersModule** — `WatchersController`, `WatchersService`
- **NotificationEmailModule** — BullMQ producer/consumer for email jobs, Nodemailer transport, HTML template renderer

### Updated Modules

- **NotificationsModule** — add `NotificationsController` (REST endpoints), expand `NotificationsService` with persistence + notification creation logic
- **CommentsModule** — add `BugCommentsController`, update `CommentsService` for polymorphic comments, add mention extraction + notification triggers
- **TasksModule** — add notification triggers on task field changes
- **BugsModule** — add notification triggers on bug field changes, add comments relation

---

## 11. Implementation Order

1. **Schema migration** — Notification, TicketWatcher models, Comment polymorphic update, Project emailNotificationsEnabled
2. **Watcher CRUD** — backend endpoints + frontend multi-select field
3. **Notification service** — persistence, creation logic, Socket.IO push
4. **Notification UI** — bell icon, dropdown, full page
5. **@Mention system** — TipTap extension, backend extraction, mention notifications
6. **Bug comments** — polymorphic Comment, bug comment endpoints, frontend reuse
7. **Notification triggers** — wire up all events (status, assignee, comments, etc.) across tasks and bugs
8. **Email pipeline** — BullMQ queue, Nodemailer transport, HTML template with PulseTrack branding
9. **Project settings** — email notification toggle
