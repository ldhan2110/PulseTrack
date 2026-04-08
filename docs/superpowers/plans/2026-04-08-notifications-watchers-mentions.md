# Notifications, Watchers & @Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent notifications, ticket watchers, @mentions in comments, bug comments, and email notifications to PulseTrack.

**Architecture:** New Prisma models (Notification, TicketWatcher) + polymorphic Comment. NotificationsService expanded with persistence + event-driven notification creation. BullMQ queue for email delivery via Nodemailer. TipTap @mention extension on frontend. Bell dropdown + full notifications page.

**Tech Stack:** Prisma 7, NestJS 11, BullMQ, Nodemailer, Socket.IO, TipTap Mention extension, React Query, shadcn/ui

---

## File Map

### New Files (Backend)
| File | Purpose |
|------|---------|
| `apps/api/src/watchers/watchers.module.ts` | WatchersModule definition |
| `apps/api/src/watchers/watchers.controller.ts` | CRUD endpoints for task/bug watchers |
| `apps/api/src/watchers/watchers.service.ts` | Watcher CRUD + query logic |
| `apps/api/src/watchers/watchers.service.spec.ts` | Unit tests for WatchersService |
| `apps/api/src/watchers/dto/add-watchers.dto.ts` | DTO for adding watchers |
| `apps/api/src/notifications/notifications.controller.ts` | REST endpoints for notification list/read/count |
| `apps/api/src/notifications/notifications.service.spec.ts` | Unit tests for NotificationsService |
| `apps/api/src/notification-email/notification-email.module.ts` | BullMQ email queue module |
| `apps/api/src/notification-email/notification-email.processor.ts` | BullMQ worker — renders + sends email |
| `apps/api/src/notification-email/notification-email.service.ts` | Email template rendering |
| `apps/api/src/notification-email/notification-email.service.spec.ts` | Unit tests for email service |
| `apps/api/src/comments/bug-comments.controller.ts` | Bug comment CRUD endpoints |
| `apps/api/src/notifications/mention-extractor.ts` | Utility to parse @mentions from HTML |
| `apps/api/src/notifications/mention-extractor.spec.ts` | Unit tests for mention extraction |

### New Files (Frontend)
| File | Purpose |
|------|---------|
| `apps/web/src/hooks/useNotifications.ts` | React Query hooks for notifications |
| `apps/web/src/hooks/useWatchers.ts` | React Query hooks for watchers CRUD |
| `apps/web/src/components/notifications/NotificationBell.tsx` | Bell icon + dropdown in header |
| `apps/web/src/components/notifications/NotificationItem.tsx` | Single notification row |
| `apps/web/src/components/notifications/NotificationDropdown.tsx` | Dropdown panel with recent notifications |
| `apps/web/src/pages/NotificationsPage.tsx` | Full /notifications page |
| `apps/web/src/components/tasks/WatcherSelect.tsx` | Multi-select watcher field component |
| `apps/web/src/components/editor/MentionSuggestion.tsx` | @mention dropdown for TipTap |

### Modified Files
| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add Notification, TicketWatcher, update Comment (bugId), update Project (emailNotificationsEnabled), update User/Bug relations |
| `apps/api/src/app.module.ts` | Import WatchersModule, NotificationEmailModule |
| `apps/api/src/queue/queue.module.ts` | Register `notification-email` queue |
| `apps/api/src/notifications/notifications.module.ts` | Add controller, PrismaModule import, export service |
| `apps/api/src/notifications/notifications.service.ts` | Add persistence, createNotifications(), getNotifications(), markRead(), getUnreadCount() |
| `apps/api/src/comments/comments.module.ts` | Import NotificationsModule |
| `apps/api/src/comments/comments.service.ts` | Add bugId support, trigger notifications on comment events, extract mentions |
| `apps/api/src/comments/comments.controller.ts` | Minor — already works |
| `apps/api/src/comments/bug-comments.controller.ts` | New — bug comment routes |
| `apps/api/src/bugs/bugs.module.ts` | Import CommentsModule |
| `apps/api/src/bugs/bugs.service.ts` | Add notification triggers |
| `apps/api/src/tasks/tasks.service.ts` | Add notification triggers for all field changes |
| `apps/api/src/projects/dto/update-settings.dto.ts` | Add emailNotificationsEnabled field |
| `apps/api/src/projects/projects.service.ts` | Handle emailNotificationsEnabled in updateSettings |
| `apps/web/src/lib/types.ts` | Add Notification, TicketWatcher types, update Comment, UpdateSettingsPayload |
| `apps/web/src/lib/api.ts` | Add notification, watcher, bug comment API methods |
| `apps/web/src/hooks/useComments.ts` | Support bugId as alternative to taskId |
| `apps/web/src/components/tasks/CommentThread.tsx` | Accept bugId prop |
| `apps/web/src/components/tasks/CommentComposer.tsx` | Add @mention extension |
| `apps/web/src/components/tasks/CommentItem.tsx` | Style mention spans |
| `apps/web/src/components/layout/ProjectLayout.tsx` | Add NotificationBell to header area |
| `apps/web/src/pages/TaskDetailPage.tsx` | Add WatcherSelect to sidebar |
| `apps/web/src/pages/BugDetailPage.tsx` | Add WatcherSelect + CommentThread |
| `apps/web/src/pages/ProjectSettingsPage.tsx` | Add email notifications toggle |
| `apps/web/src/App.tsx` | Add /notifications route |

---

## Task 1: Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add new enums and models to schema.prisma**

Add after the existing `WorkflowKind` enum:

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

Add after the `TaskHistory` model:

```prisma
// =====================
// NOTIFICATIONS & WATCHERS
// =====================

model Notification {
  id          String           @id @default(cuid())
  recipientId String
  projectId   String
  type        NotificationType
  entityType  EntityType
  entityId    String
  entityTitle String
  actorId     String
  summary     String
  metadata    Json?
  isRead      Boolean          @default(false)
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  recipient User    @relation("NotificationRecipient", fields: [recipientId], references: [id])
  actor     User    @relation("NotificationActor", fields: [actorId], references: [id])
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([recipientId, isRead, createdAt])
  @@index([recipientId, createdAt])
}

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

- [ ] **Step 2: Update Comment model to be polymorphic**

Change the Comment model — make `taskId` nullable and add `bugId`:

```prisma
model Comment {
  id        String    @id @default(cuid())
  content   String
  taskId    String?
  bugId     String?
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

- [ ] **Step 3: Update Project model**

Add to `Project` model after `bugReporterRoles`:

```prisma
  emailNotificationsEnabled Boolean @default(false)
```

Add relation:

```prisma
  notifications  Notification[]
```

- [ ] **Step 4: Update User model relations**

Add to `User` model:

```prisma
  notifications       Notification[] @relation("NotificationRecipient")
  actedNotifications  Notification[] @relation("NotificationActor")
  ticketWatches       TicketWatcher[]
```

- [ ] **Step 5: Update Bug model**

Add to `Bug` model:

```prisma
  comments       Comment[]
```

- [ ] **Step 6: Run migration**

Run: `cd apps/api && npx prisma migrate dev --name add-notifications-watchers-mentions`
Expected: Migration created and applied successfully. Prisma Client regenerated.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(schema): add Notification, TicketWatcher models, polymorphic Comment, email toggle"
```

---

## Task 2: Mention Extractor Utility

**Files:**
- Create: `apps/api/src/notifications/mention-extractor.ts`
- Create: `apps/api/src/notifications/mention-extractor.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/api/src/notifications/mention-extractor.spec.ts
import { describe, it, expect } from 'vitest';
import { extractMentionedUserIds } from './mention-extractor';

describe('extractMentionedUserIds', () => {
  it('extracts user IDs from mention spans', () => {
    const html = '<p>Hey <span data-mention-id="user1" class="mention">@Alice</span> and <span data-mention-id="user2" class="mention">@Bob</span></p>';
    expect(extractMentionedUserIds(html)).toEqual(['user1', 'user2']);
  });

  it('returns empty array when no mentions', () => {
    expect(extractMentionedUserIds('<p>No mentions here</p>')).toEqual([]);
  });

  it('deduplicates user IDs', () => {
    const html = '<p><span data-mention-id="user1">@Alice</span> and again <span data-mention-id="user1">@Alice</span></p>';
    expect(extractMentionedUserIds(html)).toEqual(['user1']);
  });

  it('handles empty string', () => {
    expect(extractMentionedUserIds('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/notifications/mention-extractor.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement mention extractor**

```typescript
// apps/api/src/notifications/mention-extractor.ts
export function extractMentionedUserIds(html: string): string[] {
  const regex = /data-mention-id="([^"]+)"/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/notifications/mention-extractor.spec.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/mention-extractor.ts apps/api/src/notifications/mention-extractor.spec.ts
git commit -m "feat(notifications): add mention extractor utility with tests"
```

---

## Task 3: Watchers Backend

**Files:**
- Create: `apps/api/src/watchers/watchers.module.ts`
- Create: `apps/api/src/watchers/watchers.controller.ts`
- Create: `apps/api/src/watchers/watchers.service.ts`
- Create: `apps/api/src/watchers/watchers.service.spec.ts`
- Create: `apps/api/src/watchers/dto/add-watchers.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the DTO**

```typescript
// apps/api/src/watchers/dto/add-watchers.dto.ts
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AddWatchersDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  userIds: string[];
}
```

- [ ] **Step 2: Write the service test**

```typescript
// apps/api/src/watchers/watchers.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatchersService } from './watchers.service';

describe('WatchersService', () => {
  let service: WatchersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      ticketWatcher: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new WatchersService(prisma);
  });

  it('findAll returns watchers for a task', async () => {
    const watchers = [{ id: 'w1', userId: 'u1', entityType: 'TASK', entityId: 't1', user: { id: 'u1', username: 'alice' } }];
    prisma.ticketWatcher.findMany.mockResolvedValue(watchers);
    const result = await service.findAll('TASK', 't1');
    expect(result).toEqual(watchers);
    expect(prisma.ticketWatcher.findMany).toHaveBeenCalledWith({
      where: { entityType: 'TASK', entityId: 't1' },
      include: { user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } } },
    });
  });

  it('addWatchers creates watcher records, skipping duplicates', async () => {
    prisma.ticketWatcher.createMany.mockResolvedValue({ count: 2 });
    await service.addWatchers('TASK', 't1', ['u1', 'u2']);
    expect(prisma.ticketWatcher.createMany).toHaveBeenCalledWith({
      data: [
        { entityType: 'TASK', entityId: 't1', userId: 'u1' },
        { entityType: 'TASK', entityId: 't1', userId: 'u2' },
      ],
      skipDuplicates: true,
    });
  });

  it('removeWatcher deletes a watcher record', async () => {
    prisma.ticketWatcher.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeWatcher('TASK', 't1', 'u1');
    expect(prisma.ticketWatcher.deleteMany).toHaveBeenCalledWith({
      where: { entityType: 'TASK', entityId: 't1', userId: 'u1' },
    });
  });

  it('getWatcherUserIds returns just user IDs', async () => {
    prisma.ticketWatcher.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    const ids = await service.getWatcherUserIds('BUG', 'b1');
    expect(ids).toEqual(['u1', 'u2']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/watchers/watchers.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement WatchersService**

```typescript
// apps/api/src/watchers/watchers.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EntityType } from '@prisma/client';

@Injectable()
export class WatchersService {
  constructor(private prisma: PrismaService) {}

  async findAll(entityType: EntityType, entityId: string) {
    return this.prisma.ticketWatcher.findMany({
      where: { entityType, entityId },
      include: {
        user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async addWatchers(entityType: EntityType, entityId: string, userIds: string[]) {
    return this.prisma.ticketWatcher.createMany({
      data: userIds.map((userId) => ({ entityType, entityId, userId })),
      skipDuplicates: true,
    });
  }

  async removeWatcher(entityType: EntityType, entityId: string, userId: string) {
    return this.prisma.ticketWatcher.deleteMany({
      where: { entityType, entityId, userId },
    });
  }

  async getWatcherUserIds(entityType: EntityType, entityId: string): Promise<string[]> {
    const watchers = await this.prisma.ticketWatcher.findMany({
      where: { entityType, entityId },
      select: { userId: true },
    });
    return watchers.map((w) => w.userId);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/watchers/watchers.service.spec.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 6: Create controller**

```typescript
// apps/api/src/watchers/watchers.controller.ts
import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WatchersService } from './watchers.service';
import { AddWatchersDto } from './dto/add-watchers.dto';
import type { EntityType } from '@prisma/client';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WatchersController {
  constructor(private watchersService: WatchersService) {}

  // ── Task Watchers ──────────────────────────────────────────────────────────
  @Get('tasks/:taskId/watchers')
  findTaskWatchers(@Param('taskId') taskId: string) {
    return this.watchersService.findAll('TASK' as EntityType, taskId);
  }

  @Post('tasks/:taskId/watchers')
  addTaskWatchers(@Param('taskId') taskId: string, @Body() dto: AddWatchersDto) {
    return this.watchersService.addWatchers('TASK' as EntityType, taskId, dto.userIds);
  }

  @Delete('tasks/:taskId/watchers/:userId')
  removeTaskWatcher(@Param('taskId') taskId: string, @Param('userId') userId: string) {
    return this.watchersService.removeWatcher('TASK' as EntityType, taskId, userId);
  }

  // ── Bug Watchers ───────────────────────────────────────────────────────────
  @Get('bugs/:bugId/watchers')
  findBugWatchers(@Param('bugId') bugId: string) {
    return this.watchersService.findAll('BUG' as EntityType, bugId);
  }

  @Post('bugs/:bugId/watchers')
  addBugWatchers(@Param('bugId') bugId: string, @Body() dto: AddWatchersDto) {
    return this.watchersService.addWatchers('BUG' as EntityType, bugId, dto.userIds);
  }

  @Delete('bugs/:bugId/watchers/:userId')
  removeBugWatcher(@Param('bugId') bugId: string, @Param('userId') userId: string) {
    return this.watchersService.removeWatcher('BUG' as EntityType, bugId, userId);
  }
}
```

- [ ] **Step 7: Create module and register in app**

```typescript
// apps/api/src/watchers/watchers.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WatchersController } from './watchers.controller';
import { WatchersService } from './watchers.service';

@Module({
  imports: [PrismaModule],
  controllers: [WatchersController],
  providers: [WatchersService],
  exports: [WatchersService],
})
export class WatchersModule {}
```

Add to `apps/api/src/app.module.ts` imports array:

```typescript
import { WatchersModule } from './watchers/watchers.module';
// Add WatchersModule to the imports array
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/watchers/ apps/api/src/app.module.ts
git commit -m "feat(watchers): add WatchersModule with CRUD for task/bug watchers"
```

---

## Task 4: Expand NotificationsService with Persistence

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`
- Create: `apps/api/src/notifications/notifications.controller.ts`
- Create: `apps/api/src/notifications/notifications.service.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/api/src/notifications/notifications.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      notification: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    service = new NotificationsService(prisma);
  });

  it('createMany inserts notifications in bulk', async () => {
    prisma.notification.createMany.mockResolvedValue({ count: 2 });
    const data = [
      { recipientId: 'u1', projectId: 'p1', type: 'STATUS_CHANGE', entityType: 'TASK', entityId: 't1', entityTitle: 'PM-1: Fix', actorId: 'u2', summary: 'Changed status' },
      { recipientId: 'u3', projectId: 'p1', type: 'STATUS_CHANGE', entityType: 'TASK', entityId: 't1', entityTitle: 'PM-1: Fix', actorId: 'u2', summary: 'Changed status' },
    ];
    await service.createMany(data as any);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({ data });
  });

  it('getUnreadCount returns count for user', async () => {
    prisma.notification.count.mockResolvedValue(5);
    const count = await service.getUnreadCount('u1');
    expect(count).toBe(5);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: 'u1', isRead: false },
    });
  });

  it('markAsRead updates single notification', async () => {
    prisma.notification.update.mockResolvedValue({ id: 'n1', isRead: true });
    await service.markAsRead('n1', 'u1');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('markAllAsRead updates all unread for user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    await service.markAllAsRead('u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'u1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/notifications/notifications.service.spec.ts`
Expected: FAIL — createMany is not a function

- [ ] **Step 3: Rewrite NotificationsService with persistence**

```typescript
// apps/api/src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private server: Server;

  constructor(private prisma: PrismaService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  notifyUser(userId: string, event: string, data: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  notifyProject(projectId: string, event: string, data: unknown): void {
    this.server?.to(`project:${projectId}`).emit(event, data);
  }

  async createMany(data: Prisma.NotificationCreateManyInput[]) {
    if (data.length === 0) return;
    await this.prisma.notification.createMany({ data });

    // Push real-time notification to each recipient
    for (const n of data) {
      this.notifyUser(n.recipientId, 'notification:new', n);
    }
  }

  async findAll(
    recipientId: string,
    opts: { page?: number; limit?: number; isRead?: boolean; type?: string },
  ) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { recipientId };
    if (opts.isRead !== undefined) where.isRead = opts.isRead;
    if (opts.type) where.type = opts.type as any;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          actor: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, recipientId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(recipientId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/notifications/notifications.service.spec.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 5: Create NotificationsController**

```typescript
// apps/api/src/notifications/notifications.controller.ts
import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationsService.findAll(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      type,
    });
  }

  @Get('count')
  getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
```

- [ ] **Step 6: Update NotificationsModule**

```typescript
// apps/api/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SocketAuthService } from './socket-auth.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, SocketAuthService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/notifications/
git commit -m "feat(notifications): add persistent notifications with REST API, pagination, mark-read"
```

---

## Task 5: Notification Email Pipeline

**Files:**
- Create: `apps/api/src/notification-email/notification-email.module.ts`
- Create: `apps/api/src/notification-email/notification-email.service.ts`
- Create: `apps/api/src/notification-email/notification-email.processor.ts`
- Create: `apps/api/src/notification-email/notification-email.service.spec.ts`
- Modify: `apps/api/src/queue/queue.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Install nodemailer**

Run: `cd apps/api && npm install nodemailer && npm install -D @types/nodemailer`

- [ ] **Step 2: Register notification-email queue**

In `apps/api/src/queue/queue.module.ts`, add `BullModule.registerQueue({ name: 'notification-email' })` to imports:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'ai-jobs' }),
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [ ] **Step 3: Write email template service test**

```typescript
// apps/api/src/notification-email/notification-email.service.spec.ts
import { describe, it, expect } from 'vitest';
import { NotificationEmailService } from './notification-email.service';

describe('NotificationEmailService', () => {
  it('renderEmailHtml produces valid HTML with PulseTrack branding', () => {
    const service = new NotificationEmailService();
    const html = service.renderEmailHtml({
      entityTitle: 'PM-42: Fix login bug',
      summary: 'John Smith changed status from "To Do" to "In Progress"',
      actorName: 'John Smith',
      viewUrl: 'http://localhost:3000/projects/PM/tasks/PM-42',
      reason: 'You are receiving this because you are watching this ticket.',
    });
    expect(html).toContain('PM-42: Fix login bug');
    expect(html).toContain('John Smith changed status');
    expect(html).toContain('View in PulseTrack');
    expect(html).toContain('PulseTrack');
    expect(html).toContain('watching this ticket');
  });

  it('renderSubject formats correctly', () => {
    const service = new NotificationEmailService();
    const subject = service.renderSubject('PM-42: Fix login bug');
    expect(subject).toBe('[PM-42: Fix login bug]');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/notification-email/notification-email.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Implement NotificationEmailService**

```typescript
// apps/api/src/notification-email/notification-email.service.ts
import { Injectable } from '@nestjs/common';

interface EmailData {
  entityTitle: string;
  summary: string;
  actorName: string;
  viewUrl: string;
  reason: string;
}

@Injectable()
export class NotificationEmailService {
  renderSubject(entityTitle: string): string {
    return `[${entityTitle}]`;
  }

  renderEmailHtml(data: EmailData): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <tr><td style="background:#18181b;padding:16px 24px">
    <span style="color:#ffffff;font-size:18px;font-weight:700">${data.entityTitle}</span>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181b;line-height:1.6">
      <strong>${data.actorName}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#3f3f46;line-height:1.6">${data.summary}</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#18181b;border-radius:6px;padding:10px 24px">
      <a href="${data.viewUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">View in PulseTrack &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="border-top:1px solid #e4e4e7;padding:16px 24px">
    <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa">${data.reason}</p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:12px 24px;text-align:center;border-top:1px solid #e4e4e7">
    <span style="font-size:14px;font-weight:700;color:#18181b">&#9679; PulseTrack</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/notification-email/notification-email.service.spec.ts`
Expected: PASS — both tests pass

- [ ] **Step 7: Create email processor**

```typescript
// apps/api/src/notification-email/notification-email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmailService } from './notification-email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Processor('notification-email', { concurrency: 5 })
export class NotificationEmailProcessor extends WorkerHost {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private emailService: NotificationEmailService,
    private config: ConfigService,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: parseInt(this.config.get('SMTP_PORT', '587'), 10),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  async process(job: Job<{ notificationId: string; recipientEmail: string; recipientName: string }>) {
    const { notificationId, recipientEmail, recipientName } = job.data;

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        actor: { select: { name: true, username: true } },
        project: { select: { prefix: true } },
      },
    });

    if (!notification) return;

    const actorName = notification.actor.name ?? notification.actor.username;
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    const prefix = notification.project.prefix ?? '';
    const entityPath = notification.entityType === 'TASK'
      ? `projects/${prefix}/tasks/${notification.entityId}`
      : `projects/${prefix}/bugs/${notification.entityId}`;
    const viewUrl = `${appUrl}/${entityPath}`;
    const reason = notification.type === 'MENTION'
      ? 'You are receiving this because you were mentioned in a comment.'
      : 'You are receiving this because you are watching this ticket.';

    const html = this.emailService.renderEmailHtml({
      entityTitle: notification.entityTitle,
      summary: notification.summary,
      actorName,
      viewUrl,
      reason,
    });

    const subject = this.emailService.renderSubject(notification.entityTitle);
    const from = this.config.get('SMTP_FROM', 'PulseTrack <noreply@pulsetrack.com>');

    await this.transporter.sendMail({
      from,
      to: recipientEmail,
      subject,
      html,
    });
  }
}
```

- [ ] **Step 8: Create email module**

```typescript
// apps/api/src/notification-email/notification-email.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationEmailProcessor } from './notification-email.processor';
import { NotificationEmailService } from './notification-email.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  providers: [NotificationEmailProcessor, NotificationEmailService],
  exports: [NotificationEmailService],
})
export class NotificationEmailModule {}
```

Add `NotificationEmailModule` to `apps/api/src/app.module.ts` imports.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/notification-email/ apps/api/src/queue/queue.module.ts apps/api/src/app.module.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(email): add BullMQ email pipeline with Nodemailer, PulseTrack-branded template"
```

---

## Task 6: Wire Notification Triggers into TasksService and BugsService

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`
- Modify: `apps/api/src/tasks/tasks.module.ts`
- Modify: `apps/api/src/bugs/bugs.service.ts`
- Modify: `apps/api/src/bugs/bugs.module.ts`

- [ ] **Step 1: Add WatchersService and email queue to TasksModule**

Update `apps/api/src/tasks/tasks.module.ts` to import `WatchersModule`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { WatchersModule } from '../watchers/watchers.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WorkflowModule,
    WatchersModule,
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 2: Add notification trigger helper to TasksService**

Add to `apps/api/src/tasks/tasks.service.ts` — inject WatchersService and email queue in constructor, add a private `triggerNotifications` method:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WatchersService } from '../watchers/watchers.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import type { NotificationType, EntityType } from '@prisma/client';

// Add to constructor:
// private watchersService: WatchersService,
// @InjectQueue('notification-email') private emailQueue: Queue,
```

Add the private trigger method:

```typescript
  private async triggerNotifications(opts: {
    projectId: string;
    entityId: string;
    entityTitle: string;
    type: NotificationType;
    actorId: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const watcherIds = await this.watchersService.getWatcherUserIds('TASK' as EntityType, opts.entityId);
    const recipientIds = watcherIds.filter((id) => id !== opts.actorId);
    if (recipientIds.length === 0) return;

    const data = recipientIds.map((recipientId) => ({
      recipientId,
      projectId: opts.projectId,
      type: opts.type,
      entityType: 'TASK' as EntityType,
      entityId: opts.entityId,
      entityTitle: opts.entityTitle,
      actorId: opts.actorId,
      summary: opts.summary,
      metadata: opts.metadata ?? undefined,
    }));
    await this.notifications.createMany(data);

    // Queue emails if project has email enabled
    const project = await this.prisma.project.findUnique({
      where: { id: opts.projectId },
      select: { emailNotificationsEnabled: true },
    });
    if (project?.emailNotificationsEnabled) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true, name: true, username: true },
      });
      for (const user of users) {
        const notif = data.find((d) => d.recipientId === user.id);
        if (notif) {
          await this.emailQueue.add('send', {
            notificationId: notif.entityId, // Will be resolved by processor
            recipientEmail: user.email,
            recipientName: user.name ?? user.username,
          });
        }
      }
    }
  }
```

- [ ] **Step 3: Wire triggers into TasksService.update()**

After the existing `this.notifications.notifyProject(...)` call in the `update` method, add notification triggers for each tracked field change:

```typescript
    // After the existing notifyProject/notifyUser calls, add:
    const taskTitle = updatedTask.taskKey
      ? `${updatedTask.taskKey}: ${updatedTask.title}`
      : updatedTask.title;

    for (const entry of historyEntries) {
      let notifType: NotificationType;
      let summary: string;
      const actorName = ''; // Will be resolved from actorId

      switch (entry.field) {
        case 'status':
          notifType = 'STATUS_CHANGE' as NotificationType;
          summary = `changed status from "${entry.oldValue ?? 'none'}" to "${entry.newValue}"`;
          break;
        case 'assigneeId':
          notifType = 'ASSIGNEE_CHANGE' as NotificationType;
          summary = `changed assignee`;
          break;
        case 'priority':
          notifType = 'PRIORITY_CHANGE' as NotificationType;
          summary = `changed priority from "${entry.oldValue ?? 'none'}" to "${entry.newValue}"`;
          break;
        case 'description':
          notifType = 'DESCRIPTION_EDIT' as NotificationType;
          summary = `updated the description`;
          break;
        case 'acceptanceCriteria':
          notifType = 'CRITERIA_CHANGE' as NotificationType;
          summary = `updated acceptance criteria`;
          break;
        case 'sprintId':
          notifType = 'SPRINT_CHANGE' as NotificationType;
          summary = `moved to a different sprint`;
          break;
        default:
          continue; // Skip fields we don't notify for
      }

      void this.triggerNotifications({
        projectId: current.projectId,
        entityId: taskId,
        entityTitle: taskTitle,
        type: notifType,
        actorId,
        summary,
        metadata: { field: entry.field, oldValue: entry.oldValue, newValue: entry.newValue },
      });
    }
```

- [ ] **Step 4: Wire triggers into TasksService.delete()**

After the existing `this.notifications.notifyProject(...)` call in `delete`:

```typescript
    // Trigger watcher notifications for deletion
    void this.triggerNotifications({
      projectId: task.projectId,
      entityId: taskId,
      entityTitle: task.taskKey ? `${task.taskKey}: ${task.title}` : task.title,
      type: 'TICKET_DELETED' as NotificationType,
      actorId: task.projectId, // Note: delete doesn't receive actorId, will need to be passed
      summary: `deleted this task`,
    });
```

- [ ] **Step 5: Update BugsModule and BugsService similarly**

Update `apps/api/src/bugs/bugs.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WatchersModule } from '../watchers/watchers.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WatchersModule,
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  controllers: [BugsController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
```

Update `apps/api/src/bugs/bugs.service.ts` — inject `NotificationsService`, `WatchersService`, and `@InjectQueue('notification-email')`. Add the same `triggerNotifications` helper (using `'BUG'` entity type). Wire triggers into `update()` and `delete()` methods with the same pattern as tasks.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/tasks/ apps/api/src/bugs/
git commit -m "feat(notifications): wire notification triggers into TasksService and BugsService"
```

---

## Task 7: Bug Comments (Polymorphic)

**Files:**
- Modify: `apps/api/src/comments/comments.service.ts`
- Create: `apps/api/src/comments/bug-comments.controller.ts`
- Modify: `apps/api/src/comments/comments.module.ts`

- [ ] **Step 1: Update CommentsService to support bugId**

Modify `apps/api/src/comments/comments.service.ts`:

- Update `findAll` to accept `{ taskId?: string; bugId?: string }`:

```typescript
  async findAll(opts: { taskId?: string; bugId?: string }) {
    const where: any = { parentId: null };
    if (opts.taskId) where.taskId = opts.taskId;
    if (opts.bugId) where.bugId = opts.bugId;

    return this.prisma.comment.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
```

- Update `create` to accept `{ taskId?: string; bugId?: string }`:

```typescript
  async create(opts: { taskId?: string; bugId?: string }, authorId: string, content: string) {
    const data: any = { authorId, content };
    if (opts.taskId) data.taskId = opts.taskId;
    if (opts.bugId) data.bugId = opts.bugId;

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data,
        include: {
          author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          replies: true,
        },
      }),
      // Only create task history if it's a task comment
      ...(opts.taskId ? [
        this.prisma.taskHistory.create({
          data: {
            taskId: opts.taskId,
            actorId: authorId,
            field: 'comment_added',
            newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
          },
        }),
      ] : []),
    ]);
    return comment;
  }
```

- Similarly update `createReply` to handle bugId.

- [ ] **Step 2: Update existing CommentsController to pass taskId as object**

In `apps/api/src/comments/comments.controller.ts`, update method calls:

```typescript
  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.commentsService.findAll({ taskId });
  }

  @Post()
  create(@Param('taskId') taskId: string, @Req() req: any, @Body() dto: CreateCommentDto) {
    return this.commentsService.create({ taskId }, req.user.id, dto.content);
  }
```

- [ ] **Step 3: Create BugCommentsController**

```typescript
// apps/api/src/comments/bug-comments.controller.ts
import {
  Controller, Get, Post, Delete, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('projects/:projectId/bugs/:bugId/comments')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class BugCommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  findAll(@Param('bugId') bugId: string) {
    return this.commentsService.findAll({ bugId });
  }

  @Post()
  create(@Param('bugId') bugId: string, @Req() req: any, @Body() dto: CreateCommentDto) {
    return this.commentsService.create({ bugId }, req.user.id, dto.content);
  }

  @Post(':commentId/replies')
  createReply(
    @Param('bugId') bugId: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() dto: CreateReplyDto,
  ) {
    return this.commentsService.createReply({ bugId }, commentId, req.user.id, dto.content);
  }

  @Patch(':commentId')
  update(@Param('commentId') commentId: string, @Req() req: any, @Body() dto: UpdateCommentDto) {
    return this.commentsService.update(commentId, req.user.id, req.user.projectRole, dto.content);
  }

  @Delete(':commentId')
  remove(@Param('commentId') commentId: string, @Req() req: any) {
    return this.commentsService.delete(commentId, req.user.id, req.user.projectRole);
  }
}
```

- [ ] **Step 4: Update CommentsModule**

```typescript
// apps/api/src/comments/comments.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommentsController } from './comments.controller';
import { BugCommentsController } from './bug-comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommentsController, BugCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
```

- [ ] **Step 5: Add mention notification triggers to CommentsService**

Inject `NotificationsService` and `WatchersService` into `CommentsService`. After creating a comment:

```typescript
    // Extract mentions and create notifications
    const mentionedIds = extractMentionedUserIds(content).filter((id) => id !== authorId);
    if (mentionedIds.length > 0) {
      const entityType = opts.taskId ? 'TASK' : 'BUG';
      const entityId = (opts.taskId ?? opts.bugId)!;
      // Look up entity title
      let entityTitle = '';
      if (opts.taskId) {
        const task = await this.prisma.task.findUnique({ where: { id: opts.taskId }, select: { taskKey: true, title: true } });
        entityTitle = task?.taskKey ? `${task.taskKey}: ${task.title}` : task?.title ?? '';
      } else {
        const bug = await this.prisma.bug.findUnique({ where: { id: opts.bugId }, select: { title: true } });
        entityTitle = bug?.title ?? '';
      }

      await this.notificationsService.createMany(
        mentionedIds.map((recipientId) => ({
          recipientId,
          projectId: '', // Will need to be passed through
          type: 'MENTION' as any,
          entityType: entityType as any,
          entityId,
          entityTitle,
          actorId: authorId,
          summary: `mentioned you in a comment`,
        })),
      );
    }
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/comments/
git commit -m "feat(comments): polymorphic Comment with bug support, @mention notifications"
```

---

## Task 8: Frontend Types and API Client Updates

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add new types**

Add to `apps/web/src/lib/types.ts`:

```typescript
// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'STATUS_CHANGE' | 'ASSIGNEE_CHANGE' | 'COMMENT_ADDED' | 'COMMENT_EDITED'
  | 'COMMENT_DELETED' | 'ATTACHMENT_CHANGE' | 'CRITERIA_CHANGE' | 'SUBTASK_CHANGE'
  | 'DESCRIPTION_EDIT' | 'SPRINT_CHANGE' | 'PRIORITY_CHANGE' | 'TICKET_DELETED' | 'MENTION';

export type EntityType = 'TASK' | 'BUG';

export interface Notification {
  id: string;
  recipientId: string;
  projectId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  actorId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

export interface NotificationPage {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

export interface TicketWatcher {
  id: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  createdAt: string;
  user: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}
```

Update `UpdateSettingsPayload`:

```typescript
export interface UpdateSettingsPayload {
  name?: string;
  description?: string;
  prefix?: string;
  emailNotificationsEnabled?: boolean;
}
```

Update `Comment` interface — add optional `bugId`:

```typescript
export interface Comment {
  id: string;
  content: string;
  taskId: string | null;
  bugId: string | null;
  authorId: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
  replies?: Comment[];
}
```

- [ ] **Step 2: Add API methods**

Add to `apps/web/src/lib/api.ts`:

```typescript
  // ─── Notifications ──────────────────────────────────────────────────────────
  getNotifications: (params?: { page?: number; limit?: number; isRead?: boolean; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.isRead !== undefined) searchParams.set('isRead', String(params.isRead));
    if (params?.type) searchParams.set('type', params.type);
    const qs = searchParams.toString();
    return request<NotificationPage>(`/notifications${qs ? `?${qs}` : ''}`);
  },
  getNotificationCount: () =>
    request<{ count: number }>('/notifications/count'),
  markNotificationRead: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<void>('/notifications/read-all', { method: 'PATCH' }),

  // ─── Watchers ───────────────────────────────────────────────────────────────
  getTaskWatchers: (projectId: string, taskId: string) =>
    request<TicketWatcher[]>(`/projects/${projectId}/tasks/${taskId}/watchers`),
  addTaskWatchers: (projectId: string, taskId: string, userIds: string[]) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/watchers`, {
      method: 'POST', body: JSON.stringify({ userIds }),
    }),
  removeTaskWatcher: (projectId: string, taskId: string, userId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/watchers/${userId}`, { method: 'DELETE' }),
  getBugWatchers: (projectId: string, bugId: string) =>
    request<TicketWatcher[]>(`/projects/${projectId}/bugs/${bugId}/watchers`),
  addBugWatchers: (projectId: string, bugId: string, userIds: string[]) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/watchers`, {
      method: 'POST', body: JSON.stringify({ userIds }),
    }),
  removeBugWatcher: (projectId: string, bugId: string, userId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/watchers/${userId}`, { method: 'DELETE' }),

  // ─── Bug Comments ──────────────────────────────────────────────────────────
  getBugComments: (projectId: string, bugId: string) =>
    request<Comment[]>(`/projects/${projectId}/bugs/${bugId}/comments`),
  createBugComment: (projectId: string, bugId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/bugs/${bugId}/comments`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  createBugReply: (projectId: string, bugId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}/replies`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  deleteBugComment: (projectId: string, bugId: string, commentId: string) =>
    request<void>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}`, { method: 'DELETE' }),
  updateBugComment: (projectId: string, bugId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
```

Add imports at top of api.ts for the new types:

```typescript
import type { ..., Notification, NotificationPage, TicketWatcher } from './types';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(frontend): add notification, watcher, bug comment types and API methods"
```

---

## Task 9: Frontend Hooks (Notifications, Watchers, Bug Comments)

**Files:**
- Create: `apps/web/src/hooks/useNotifications.ts`
- Create: `apps/web/src/hooks/useWatchers.ts`
- Modify: `apps/web/src/hooks/useComments.ts`

- [ ] **Step 1: Create useNotifications hook**

```typescript
// apps/web/src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useNotifications(params?: { page?: number; isRead?: boolean; type?: string }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => api.getNotifications(params),
  });
}

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notification-count'],
    queryFn: () => api.getNotificationCount(),
    refetchInterval: 30000, // Poll every 30s as fallback
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });
}
```

- [ ] **Step 2: Create useWatchers hook**

```typescript
// apps/web/src/hooks/useWatchers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { EntityType } from '../lib/types';

export function useWatchers(projectId: string, entityType: EntityType, entityId: string) {
  const isTask = entityType === 'TASK';
  return useQuery({
    queryKey: ['watchers', projectId, entityType, entityId],
    queryFn: () => isTask
      ? api.getTaskWatchers(projectId, entityId)
      : api.getBugWatchers(projectId, entityId),
    enabled: !!projectId && !!entityId,
  });
}

export function useAddWatchers(projectId: string, entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  const isTask = entityType === 'TASK';
  return useMutation({
    mutationFn: (userIds: string[]) => isTask
      ? api.addTaskWatchers(projectId, entityId, userIds)
      : api.addBugWatchers(projectId, entityId, userIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watchers', projectId, entityType, entityId] });
    },
  });
}

export function useRemoveWatcher(projectId: string, entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  const isTask = entityType === 'TASK';
  return useMutation({
    mutationFn: (userId: string) => isTask
      ? api.removeTaskWatcher(projectId, entityId, userId)
      : api.removeBugWatcher(projectId, entityId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watchers', projectId, entityType, entityId] });
    },
  });
}
```

- [ ] **Step 3: Update useComments to support bugId**

Update `apps/web/src/hooks/useComments.ts` to accept an `entity` parameter:

```typescript
// apps/web/src/hooks/useComments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

type CommentEntity = { type: 'task'; taskId: string } | { type: 'bug'; bugId: string };

function commentQueryKey(projectId: string, entity: CommentEntity) {
  return entity.type === 'task'
    ? ['comments', projectId, entity.taskId]
    : ['bug-comments', projectId, entity.bugId];
}

export function useComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['comments', projectId, taskId],
    queryFn: () => api.getComments(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useBugComments(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['bug-comments', projectId, bugId],
    queryFn: () => api.getBugComments(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}

export function useCreateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.createComment(projectId, taskId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useCreateBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.createBugComment(projectId, bugId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useCreateReply(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.createReply(projectId, taskId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useCreateBugReply(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.createBugReply(projectId, bugId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useDeleteComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(projectId, taskId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useDeleteBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteBugComment(projectId, bugId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useUpdateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.updateComment(projectId, taskId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      toast.success('Comment updated');
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useUpdateBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.updateBugComment(projectId, bugId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
      toast.success('Comment updated');
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useNotifications.ts apps/web/src/hooks/useWatchers.ts apps/web/src/hooks/useComments.ts
git commit -m "feat(frontend): add notification, watcher, bug comment hooks"
```

---

## Task 10: WatcherSelect Component

**Files:**
- Create: `apps/web/src/components/tasks/WatcherSelect.tsx`

- [ ] **Step 1: Create the WatcherSelect component**

```typescript
// apps/web/src/components/tasks/WatcherSelect.tsx
import { useState } from 'react';
import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWatchers, useAddWatchers, useRemoveWatcher } from '@/hooks/useWatchers';
import { useMembers } from '@/hooks/useMembers';
import type { EntityType, Member } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface WatcherSelectProps {
  projectId: string;
  entityType: EntityType;
  entityId: string;
  currentUserId: string;
}

export function WatcherSelect({ projectId, entityType, entityId, currentUserId }: WatcherSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: watchers = [] } = useWatchers(projectId, entityType, entityId);
  const { data: members = [] } = useMembers(projectId);
  const addWatchers = useAddWatchers(projectId, entityType, entityId);
  const removeWatcher = useRemoveWatcher(projectId, entityType, entityId);

  const watcherUserIds = new Set(watchers.map((w) => w.userId));
  const isWatching = watcherUserIds.has(currentUserId);
  const nonWatcherMembers = members.filter((m) => !watcherUserIds.has(m.userId));

  const handleToggleSelf = () => {
    if (isWatching) {
      removeWatcher.mutate(currentUserId);
    } else {
      addWatchers.mutate([currentUserId]);
    }
  };

  const handleAddMember = (userId: string) => {
    addWatchers.mutate([userId]);
    setOpen(false);
  };

  const handleRemove = (userId: string) => {
    removeWatcher.mutate(userId);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted-foreground">Watchers</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={handleToggleSelf}
        >
          {isWatching ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {isWatching ? 'Unwatch' : 'Watch'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {watchers.map((w) => (
          <div key={w.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs group">
            <Avatar className="size-4">
              {w.user.imageUrl && <AvatarImage src={w.user.imageUrl} />}
              <AvatarFallback className="text-[8px]">
                {getInitials(w.user.name ?? w.user.username)}
              </AvatarFallback>
            </Avatar>
            <span>{w.user.name ?? w.user.username}</span>
            <button
              onClick={() => handleRemove(w.userId)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 rounded-full">
              <Plus className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-56" align="start">
            <Command>
              <CommandInput placeholder="Add watcher..." />
              <CommandList>
                <CommandEmpty>No members found</CommandEmpty>
                <CommandGroup>
                  {nonWatcherMembers.map((m) => (
                    <CommandItem key={m.userId} onSelect={() => handleAddMember(m.userId)}>
                      <Avatar className="size-5 mr-2">
                        {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                        <AvatarFallback className="text-[9px]">
                          {getInitials(m.user.name ?? m.user.username)}
                        </AvatarFallback>
                      </Avatar>
                      {m.user.name ?? m.user.username}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/WatcherSelect.tsx
git commit -m "feat(frontend): add WatcherSelect multi-select component"
```

---

## Task 11: @Mention TipTap Extension

**Files:**
- Create: `apps/web/src/components/editor/MentionSuggestion.tsx`
- Modify: `apps/web/src/components/tasks/CommentComposer.tsx`
- Modify: `apps/web/src/components/tasks/CommentItem.tsx`

- [ ] **Step 1: Install @tiptap/extension-mention**

Run: `cd apps/web && npm install @tiptap/extension-mention`

- [ ] **Step 2: Create MentionSuggestion component**

```typescript
// apps/web/src/components/editor/MentionSuggestion.tsx
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface MentionSuggestionRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps extends SuggestionProps {
  items: Array<{ id: string; label: string }>;
}

export const MentionList = forwardRef<MentionSuggestionRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="rounded-md border bg-popover p-1 shadow-md">
        {items.map((item, i) => (
          <button
            key={item.id}
            className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm ${
              i === selectedIndex ? 'bg-accent text-accent-foreground' : ''
            }`}
            onClick={() => command(item)}
          >
            @{item.label}
          </button>
        ))}
      </div>
    );
  },
);
MentionList.displayName = 'MentionList';
```

- [ ] **Step 3: Add Mention extension to CommentComposer**

In `apps/web/src/components/tasks/CommentComposer.tsx`:

Add imports:

```typescript
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import { MentionList, type MentionSuggestionRef } from '@/components/editor/MentionSuggestion';
```

Add `members` prop to `CommentComposerProps`:

```typescript
interface CommentComposerProps {
  onSubmit: (content: string) => void;
  isPending: boolean;
  projectId: string;
  taskId: string;
  placeholder?: string;
  onCancel?: () => void;
  members?: Array<{ id: string; label: string }>;
}
```

Add the Mention extension to the `useEditor` extensions array:

```typescript
    Mention.configure({
      HTMLAttributes: { class: 'mention' },
      renderHTML({ options, node }) {
        return ['span', { ...options.HTMLAttributes, 'data-mention-id': node.attrs.id }, `@${node.attrs.label}`];
      },
      suggestion: {
        items: ({ query }) => {
          return (members ?? []).filter((m) =>
            m.label.toLowerCase().includes(query.toLowerCase()),
          ).slice(0, 5);
        },
        render: () => {
          let component: ReactRenderer<MentionSuggestionRef>;
          let popup: Instance[];
          return {
            onStart: (props) => {
              component = new ReactRenderer(MentionList, { props, editor: props.editor });
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props) => {
              component.updateProps(props);
              popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
            },
            onKeyDown: (props) => component.ref?.onKeyDown(props) ?? false,
            onExit: () => { popup[0]?.destroy(); component.destroy(); },
          };
        },
      },
    }),
```

- [ ] **Step 4: Style mention spans in CommentItem**

In `apps/web/src/components/tasks/CommentItem.tsx`, add to DOMPurify config and the prose className:

```typescript
// Update DOMPurify.sanitize to allow data-mention-id attribute
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content, { ADD_ATTR: ['data-mention-id'] }) }}
```

Add mention styling to the prose div className:

```
[&_.mention]:bg-blue-100 [&_.mention]:text-blue-800 [&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:font-medium
```

- [ ] **Step 5: Install tippy.js**

Run: `cd apps/web && npm install tippy.js`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/editor/MentionSuggestion.tsx apps/web/src/components/tasks/CommentComposer.tsx apps/web/src/components/tasks/CommentItem.tsx apps/web/package.json
git commit -m "feat(frontend): add @mention support with TipTap Mention extension"
```

---

## Task 12: Notification Bell & Dropdown

**Files:**
- Create: `apps/web/src/components/notifications/NotificationItem.tsx`
- Create: `apps/web/src/components/notifications/NotificationDropdown.tsx`
- Create: `apps/web/src/components/notifications/NotificationBell.tsx`
- Modify: `apps/web/src/components/layout/ProjectLayout.tsx`

- [ ] **Step 1: Create NotificationItem**

```typescript
// apps/web/src/components/notifications/NotificationItem.tsx
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Notification } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const actor = notification.actor;
  const relTime = (() => {
    try { return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }); }
    catch { return notification.createdAt; }
  })();

  return (
    <button
      className={`flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors ${
        !notification.isRead ? 'bg-blue-50/50' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      {!notification.isRead && (
        <span className="mt-2 size-2 rounded-full bg-blue-500 shrink-0" />
      )}
      <Avatar className="size-6 shrink-0 mt-0.5">
        {actor.imageUrl && <AvatarImage src={actor.imageUrl} />}
        <AvatarFallback className="text-[10px]">
          {getInitials(actor.name ?? actor.username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-medium">{actor.name ?? actor.username}</span>{' '}
          {notification.summary}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {notification.entityTitle} &middot; {relTime}
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create NotificationDropdown**

```typescript
// apps/web/src/components/notifications/NotificationDropdown.tsx
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/lib/types';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { data } = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const notifications = data?.items ?? [];

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    // Navigate to entity — need project prefix which isn't in notification
    // For now close the dropdown; full page has better navigation
    onClose();
  };

  return (
    <div className="w-80 max-h-96 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Notifications</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => markAllRead.mutate()}>
          Mark all read
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleClick} />
          ))
        )}
      </div>
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => { navigate('/notifications'); onClose(); }}
        >
          View all notifications
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create NotificationBell**

```typescript
// apps/web/src/components/notifications/NotificationBell.tsx
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotificationCount } from '@/hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotificationCount();
  const count = data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8">
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center size-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="end" sideOffset={8}>
        <NotificationDropdown onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Add NotificationBell to ProjectLayout**

In `apps/web/src/components/layout/ProjectLayout.tsx`, add the bell to the header area. Add it inside `SidebarInset`, before `<main>`:

```typescript
import { NotificationBell } from '@/components/notifications/NotificationBell';

// Inside the SidebarInset, before <main>:
<div className="flex justify-end px-4 pt-2">
  <NotificationBell />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/notifications/ apps/web/src/components/layout/ProjectLayout.tsx
git commit -m "feat(frontend): add NotificationBell dropdown with real-time count"
```

---

## Task 13: Full Notifications Page

**Files:**
- Create: `apps/web/src/pages/NotificationsPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create NotificationsPage**

```typescript
// apps/web/src/pages/NotificationsPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import type { Notification } from '@/lib/types';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'STATUS_CHANGE', label: 'Status changes' },
  { value: 'ASSIGNEE_CHANGE', label: 'Assignee changes' },
  { value: 'COMMENT_ADDED', label: 'Comments' },
  { value: 'MENTION', label: 'Mentions' },
  { value: 'ATTACHMENT_CHANGE', label: 'Attachments' },
  { value: 'CRITERIA_CHANGE', label: 'Criteria' },
  { value: 'SUBTASK_CHANGE', label: 'Sub-tasks' },
  { value: 'PRIORITY_CHANGE', label: 'Priority' },
];

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [isReadFilter, setIsReadFilter] = useState<boolean | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState('');
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const { data, isLoading } = useNotifications({
    page,
    limit: 20,
    isRead: isReadFilter,
    type: typeFilter || undefined,
  });

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="size-5" />
          <h1 className="text-xl font-semibold">Notifications</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Tabs
          value={isReadFilter === undefined ? 'all' : isReadFilter ? 'read' : 'unread'}
          onValueChange={(v) => {
            setIsReadFilter(v === 'all' ? undefined : v === 'read');
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border divide-y">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleClick} />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

Add import and route:

```typescript
import { NotificationsPage } from './pages/NotificationsPage';

// Add inside the ProjectLayout Route, after /my-tasks:
<Route path="/notifications" element={<NotificationsPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/NotificationsPage.tsx apps/web/src/App.tsx
git commit -m "feat(frontend): add full notifications page with filtering and pagination"
```

---

## Task 14: Wire Watchers and Bug Comments into Detail Pages

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`
- Modify: `apps/web/src/pages/BugDetailPage.tsx`
- Modify: `apps/web/src/components/tasks/CommentThread.tsx`

- [ ] **Step 1: Update CommentThread to support bug comments**

Add `entityType` and `bugId` props to `CommentThread`:

```typescript
// apps/web/src/components/tasks/CommentThread.tsx
interface CommentThreadProps {
  projectId: string;
  taskId?: string;
  bugId?: string;
  currentUserId: string;
  canManage: boolean;
  members?: Array<{ id: string; label: string }>;
}
```

Inside the component, conditionally use task or bug hooks:

```typescript
  const isTask = !!taskId;
  const { data: taskComments = [] } = useComments(projectId, taskId ?? '');
  const { data: bugCommentsList = [] } = useBugComments(projectId, bugId ?? '');
  const comments = isTask ? taskComments : bugCommentsList;

  const createTaskComment = useCreateComment(projectId, taskId ?? '');
  const createBugComment = useCreateBugComment(projectId, bugId ?? '');
  const createComment = isTask ? createTaskComment : createBugComment;

  // Similarly for reply, delete, update hooks
```

Pass `members` prop to `CommentComposer`.

- [ ] **Step 2: Add WatcherSelect to TaskDetailPage sidebar**

In `apps/web/src/pages/TaskDetailPage.tsx`, import and add:

```typescript
import { WatcherSelect } from '@/components/tasks/WatcherSelect';

// In the sidebar section (after assignee or sprint select), add:
<WatcherSelect
  projectId={projectId}
  entityType="TASK"
  entityId={task.id}
  currentUserId={currentUser.id}
/>
```

- [ ] **Step 3: Add WatcherSelect and CommentThread to BugDetailPage**

In `apps/web/src/pages/BugDetailPage.tsx`, import and add:

```typescript
import { WatcherSelect } from '@/components/tasks/WatcherSelect';
import { CommentThread } from '@/components/tasks/CommentThread';

// In the sidebar:
<WatcherSelect
  projectId={projectId}
  entityType="BUG"
  entityId={bug.id}
  currentUserId={currentUser.id}
/>

// Add a Comments section (new tab or below existing content):
<CommentThread
  projectId={projectId}
  bugId={bug.id}
  currentUserId={currentUser.id}
  canManage={canManage}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx apps/web/src/pages/BugDetailPage.tsx apps/web/src/components/tasks/CommentThread.tsx
git commit -m "feat(frontend): add WatcherSelect and bug comments to detail pages"
```

---

## Task 15: Project Settings — Email Toggle

**Files:**
- Modify: `apps/api/src/projects/dto/update-settings.dto.ts`
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/web/src/pages/ProjectSettingsPage.tsx`

- [ ] **Step 1: Update backend DTO and service**

In `apps/api/src/projects/dto/update-settings.dto.ts`, add:

```typescript
import { IsBoolean } from 'class-validator';

// Add to UpdateSettingsDto:
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;
```

In `apps/api/src/projects/projects.service.ts`, update `updateSettings`:

```typescript
  async updateSettings(projectId: string, dto: UpdateSettingsDto) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.prefix !== undefined && { prefix: dto.prefix }),
        ...(dto.emailNotificationsEnabled !== undefined && {
          emailNotificationsEnabled: dto.emailNotificationsEnabled,
        }),
      },
    });
  }
```

- [ ] **Step 2: Add toggle to ProjectSettingsPage**

In `apps/web/src/pages/ProjectSettingsPage.tsx`, add in the General tab's card (after the prefix field):

```typescript
import { Switch } from '@/components/ui/switch';

// Add state:
const [emailEnabled, setEmailEnabled] = useState(false);

// In the initialization block:
if (project && !initialized) {
  // existing...
  setEmailEnabled(project.emailNotificationsEnabled ?? false);
}

// Add to the form UI:
<div className="flex items-center justify-between rounded-lg border p-3">
  <div>
    <Label className="text-sm font-medium">Email Notifications</Label>
    <p className="text-xs text-muted-foreground">Send email notifications to watchers and mentioned users</p>
  </div>
  <Switch
    checked={emailEnabled}
    onCheckedChange={(checked) => {
      setEmailEnabled(checked);
      updateSettings.mutate({ emailNotificationsEnabled: checked });
    }}
    disabled={!canManage}
  />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/projects/dto/update-settings.dto.ts apps/api/src/projects/projects.service.ts apps/web/src/pages/ProjectSettingsPage.tsx
git commit -m "feat(settings): add email notifications toggle to project settings"
```

---

## Task 16: Real-Time Socket.IO Integration for Notifications

**Files:**
- Modify: `apps/web/src/hooks/useNotifications.ts`
- Modify: `apps/web/src/hooks/useTaskSync.ts` (or create a new `useNotificationSync.ts`)

- [ ] **Step 1: Add socket listener for notification events**

Check how the existing `useTaskSync` hook works and create a similar pattern. Add to `useNotifications.ts`:

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import keycloak from '@/auth/keycloak';

export function useNotificationSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = io('/', {
      auth: { token: keycloak.token },
      transports: ['websocket'],
    });

    socket.on('notification:new', () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notification-count'] });
    });

    return () => { socket.disconnect(); };
  }, [qc]);
}
```

Call `useNotificationSync()` from `ProjectLayout` or a top-level provider.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useNotifications.ts apps/web/src/components/layout/ProjectLayout.tsx
git commit -m "feat(frontend): add real-time Socket.IO notification sync"
```
