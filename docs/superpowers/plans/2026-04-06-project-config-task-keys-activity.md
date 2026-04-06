# Project Config, Task Keys, Comment Editing & Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project settings page with avatar/prefix config, JIRA-style task keys, comment editing, and a redesigned activity feed with comprehensive change tracking.

**Architecture:** Extend existing Project/Task/Comment models with new fields. Change URL routing from CUIDs to human-readable prefix/taskKey slugs. Expand TaskHistory to track comment, description, attachment, and criteria changes. Redesign activity feed with icon-based timeline.

**Tech Stack:** Prisma (migrations), NestJS (API), React + TanStack Query (frontend), Tiptap (comment editing), Tailwind + shadcn/ui (UI), lucide-react (icons)

---

## Task 1: Database Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add new fields to Project model**

In `apps/api/prisma/schema.prisma`, add these fields to the `Project` model (after `updatedAt`):

```prisma
  prefix    String?   @unique   // 2-10 uppercase letters, URL slug + task key prefix
  taskSeq   Int       @default(0) // Auto-incrementing counter for task keys
  avatarUrl String?   // Path to uploaded avatar image
```

Note: `prefix` is nullable initially for migration compatibility. Will be made required after backfill.

- [ ] **Step 2: Add taskKey to Task model**

In `apps/api/prisma/schema.prisma`, add this field to the `Task` model (after `title`):

```prisma
  taskKey   String?   @unique   // e.g. "PM-1", "ACME-42"
```

Nullable initially for migration. Will be backfilled.

- [ ] **Step 3: Add isEdited to Comment model**

In `apps/api/prisma/schema.prisma`, add this field to the `Comment` model (after `parentId`):

```prisma
  isEdited  Boolean   @default(false)
```

- [ ] **Step 4: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add-prefix-taskkey-isedited
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add prefix, taskKey, isEdited schema fields"
```

---

## Task 2: Backend - Project Settings & Avatar Upload

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.controller.ts`
- Modify: `apps/api/src/projects/dto/create-project.dto.ts`
- Modify: `apps/api/src/projects/dto/update-project.dto.ts`
- Create: `apps/api/src/projects/dto/update-settings.dto.ts`

- [ ] **Step 1: Create UpdateSettingsDto**

Create `apps/api/src/projects/dto/update-settings.dto.ts`:

```typescript
import { IsString, IsOptional, Matches, MinLength, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z]{2,10}$/, { message: 'Prefix must be 2-10 uppercase letters' })
  prefix?: string;
}
```

- [ ] **Step 2: Add prefix to CreateProjectDto**

In `apps/api/src/projects/dto/create-project.dto.ts`, add:

```typescript
import { IsString, IsOptional, Matches, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
```

Add the prefix field:

```typescript
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z]{2,10}$/, { message: 'Prefix must be 2-10 uppercase letters' })
  prefix: string;
```

- [ ] **Step 3: Update ProjectsService**

In `apps/api/src/projects/projects.service.ts`, modify the `create` method to include `prefix`:

```typescript
  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          prefix: dto.prefix,
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: 'pm',
        },
      });

      return project;
    });
  }
```

Add `findByPrefix` method:

```typescript
  async findByPrefix(prefix: string) {
    const project = await this.prisma.project.findUnique({
      where: { prefix },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with prefix ${prefix} not found`);
    }

    return project;
  }
```

Add `updateSettings` method:

```typescript
  async updateSettings(projectId: string, dto: UpdateSettingsDto) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.prefix !== undefined && { prefix: dto.prefix }),
      },
    });
  }
```

Add `updateAvatar` method:

```typescript
  async updateAvatar(projectId: string, avatarUrl: string | null) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { avatarUrl },
    });
  }
```

Update `findAllForUser` to include `prefix` and `avatarUrl` in the return:

```typescript
        return {
          id: m.project.id,
          name: m.project.name,
          description: m.project.description,
          prefix: m.project.prefix,
          avatarUrl: m.project.avatarUrl,
          archived: m.project.archived,
          createdAt: m.project.createdAt,
          userRole: m.role,
          taskSummary: {
            total: m.project._count.tasks,
            inProgress: inProgressCount,
            blocked: blockedCount,
          },
        };
```

- [ ] **Step 4: Update ProjectsController**

In `apps/api/src/projects/projects.controller.ts`, add imports and new endpoints:

Add imports for `FileInterceptor`, `UploadedFile`, `UseInterceptors`, `Delete`, `diskStorage`, `randomUUID`, `extname`, `mkdirSync`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
```

Import the new DTO:

```typescript
import { UpdateSettingsDto } from './dto/update-settings.dto';
```

Add new endpoints:

```typescript
  @Get('by-prefix/:prefix')
  @UseGuards(ProjectRolesGuard)
  findByPrefix(@Param('prefix') prefix: string) {
    return this.projectsService.findByPrefix(prefix);
  }

  @Patch(':projectId/settings')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  updateSettings(@Param('projectId') projectId: string, @Body() dto: UpdateSettingsDto) {
    return this.projectsService.updateSettings(projectId, dto);
  }

  @Post(':projectId/avatar')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'avatars');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpe?g|webp)$/)) {
          cb(new Error('Only PNG, JPG, and WebP images are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadAvatar(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const avatarUrl = `/api/uploads/avatars/${file.filename}`;
    return this.projectsService.updateAvatar(projectId, avatarUrl);
  }

  @Delete(':projectId/avatar')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles('pm')
  async removeAvatar(@Param('projectId') projectId: string) {
    return this.projectsService.updateAvatar(projectId, null);
  }
```

- [ ] **Step 5: Serve static avatar files**

In `apps/api/src/main.ts`, add static file serving for avatar uploads. Add after the app creation:

```typescript
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
```

And in the bootstrap function, add:

```typescript
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/api/uploads' });
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/projects/ apps/api/src/main.ts
git commit -m "feat: add project settings, avatar upload, and prefix endpoints"
```

---

## Task 3: Backend - Task Key System

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`

- [ ] **Step 1: Update task create to generate taskKey**

In `apps/api/src/tasks/tasks.service.ts`, modify the `create` method to atomically increment `taskSeq` and generate `taskKey`:

```typescript
  async create(projectId: string, creatorId: string, dto: CreateTaskDto) {
    return this.prisma.$transaction(async (tx) => {
      // Atomically increment the project's task sequence
      const project = await tx.project.update({
        where: { id: projectId },
        data: { taskSeq: { increment: 1 } },
        select: { prefix: true, taskSeq: true },
      });

      const taskKey = project.prefix ? `${project.prefix}-${project.taskSeq}` : null;

      return tx.task.create({
        data: {
          projectId,
          creatorId,
          title: dto.title,
          taskKey,
          description: dto.description,
          status: dto.status,
          assigneeId: dto.assigneeId,
          storyPoints: dto.storyPoints,
          sprintId: dto.sprintId,
          acceptanceCriteria: dto.acceptanceCriteria,
        },
        include: {
          assignee: { select: { id: true, username: true, email: true } },
          sprint: { select: { id: true, name: true } },
        },
      });
    });
  }
```

- [ ] **Step 2: Add findByTaskKey method**

Add a new method to `TasksService`:

```typescript
  async findByTaskKey(taskKey: string) {
    return this.prisma.task.findUnique({
      where: { taskKey },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        creator: { select: { id: true, username: true, email: true } },
        subTasks: {
          include: {
            assignee: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
```

- [ ] **Step 3: Update findAll to include taskKey**

The existing `findAll` already returns all Task fields since it uses `findMany` — `taskKey` is automatically included. No change needed.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tasks/
git commit -m "feat: generate JIRA-style task keys on creation"
```

---

## Task 4: Backend - Comment Editing with History

**Files:**
- Modify: `apps/api/src/comments/comments.service.ts`
- Modify: `apps/api/src/comments/comments.controller.ts`
- Create: `apps/api/src/comments/dto/update-comment.dto.ts`

- [ ] **Step 1: Create UpdateCommentDto**

Create `apps/api/src/comments/dto/update-comment.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
```

- [ ] **Step 2: Add update method to CommentsService**

In `apps/api/src/comments/comments.service.ts`, add:

```typescript
  async update(commentId: string, userId: string, userRole: string, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the comment author or a PM can edit this comment');
    }

    const oldContent = comment.content;

    const [updated] = await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: commentId },
        data: { content, isEdited: true },
        include: {
          author: { select: { id: true, username: true, email: true } },
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId: comment.taskId,
          actorId: userId,
          field: 'comment_edited',
          oldValue: oldContent.replace(/<[^>]*>/g, '').slice(0, 500),
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 500),
        },
      }),
    ]);

    return updated;
  }
```

- [ ] **Step 3: Update create and createReply to log history**

Modify the `create` method in `CommentsService` to also create a history entry:

```typescript
  async create(taskId: string, authorId: string, content: string) {
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { taskId, authorId, content },
        include: {
          author: { select: { id: true, username: true, email: true } },
          replies: true,
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId,
          actorId: authorId,
          field: 'comment_added',
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
    return comment;
  }
```

Modify `createReply` similarly:

```typescript
  async createReply(taskId: string, parentId: string, authorId: string, content: string) {
    const parent = await this.prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.taskId !== taskId) {
      throw new NotFoundException('Parent comment not found');
    }
    const [reply] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { taskId, authorId, content, parentId },
        include: {
          author: { select: { id: true, username: true, email: true } },
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId,
          actorId: authorId,
          field: 'comment_added',
          newValue: content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
    return reply;
  }
```

- [ ] **Step 4: Update delete to log history**

Modify the `delete` method:

```typescript
  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the comment author or a PM can delete this comment');
    }
    await this.prisma.$transaction([
      this.prisma.comment.deleteMany({ where: { parentId: commentId } }),
      this.prisma.comment.delete({ where: { id: commentId } }),
      this.prisma.taskHistory.create({
        data: {
          taskId: comment.taskId,
          actorId: userId,
          field: 'comment_deleted',
          oldValue: comment.content.replace(/<[^>]*>/g, '').slice(0, 200),
        },
      }),
    ]);
  }
```

- [ ] **Step 5: Add update endpoint to CommentsController**

In `apps/api/src/comments/comments.controller.ts`, add the `Patch` import and endpoint:

```typescript
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { UpdateCommentDto } from './dto/update-comment.dto';
```

Add the endpoint:

```typescript
  @Patch(':commentId')
  update(
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(commentId, req.user.id, req.user.projectRole, dto.content);
  }
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/comments/
git commit -m "feat: add comment editing with history tracking"
```

---

## Task 5: Backend - Extended Activity Tracking

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`
- Modify: `apps/api/src/attachments/attachments.service.ts`

- [ ] **Step 1: Track description and acceptanceCriteria changes in TasksService**

In `apps/api/src/tasks/tasks.service.ts`, update the `update` method. Expand the tracked fields:

```typescript
  async update(taskId: string, dto: UpdateTaskDto, actorId: string) {
    const current = await this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });

    // Build history entries for tracked fields
    const trackedFields = ['status', 'assigneeId', 'sprintId', 'storyPoints', 'title'] as const;
    const historyEntries = trackedFields
      .filter(f => dto[f] !== undefined && String(dto[f] ?? '') !== String(current[f] ?? ''))
      .map(f => ({
        taskId,
        actorId,
        field: f,
        oldValue: current[f] != null ? String(current[f]) : null,
        newValue: dto[f] != null ? String(dto[f]) : null,
      }));

    // Track description changes
    if (dto.description !== undefined && dto.description !== current.description) {
      historyEntries.push({
        taskId,
        actorId,
        field: 'description',
        oldValue: current.description ? current.description.replace(/<[^>]*>/g, '').slice(0, 500) : null,
        newValue: dto.description ? dto.description.replace(/<[^>]*>/g, '').slice(0, 500) : null,
      });
    }

    // Track acceptance criteria changes
    if (dto.acceptanceCriteria !== undefined && dto.acceptanceCriteria !== current.acceptanceCriteria) {
      historyEntries.push({
        taskId,
        actorId,
        field: 'acceptanceCriteria',
        oldValue: current.acceptanceCriteria ?? null,
        newValue: dto.acceptanceCriteria ?? null,
      });
    }

    const [updatedTask] = await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(dto.storyPoints !== undefined && { storyPoints: dto.storyPoints }),
          ...(dto.sprintId !== undefined && { sprintId: dto.sprintId }),
          ...(dto.acceptanceCriteria !== undefined && {
            acceptanceCriteria: dto.acceptanceCriteria,
          }),
        },
        include: {
          assignee: { select: { id: true, username: true, email: true } },
          sprint: { select: { id: true, name: true } },
        },
      }),
      ...historyEntries.map(e => this.prisma.taskHistory.create({ data: e })),
    ]);

    return updatedTask;
  }
```

- [ ] **Step 2: Track attachment uploads/deletions in AttachmentsService**

In `apps/api/src/attachments/attachments.service.ts`, modify `create` to log history:

```typescript
  async create(taskId: string, uploaderId: string, file: Express.Multer.File) {
    const [attachment] = await this.prisma.$transaction([
      this.prisma.attachment.create({
        data: {
          taskId,
          uploaderId,
          filename: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
        },
        include: {
          uploader: { select: { id: true, username: true, email: true } },
        },
      }),
      this.prisma.taskHistory.create({
        data: {
          taskId,
          actorId: uploaderId,
          field: 'attachment_added',
          newValue: file.originalname,
        },
      }),
    ]);
    return attachment;
  }
```

Modify `delete` to log history:

```typescript
  async delete(attachmentId: string, userId: string, userRole: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the uploader or a PM can delete this attachment');
    }
    try {
      const filePath = join(process.cwd(), 'uploads', 'tasks', attachment.taskId, attachment.storedName);
      unlinkSync(filePath);
    } catch {
      // File may already be missing
    }
    const [deleted] = await this.prisma.$transaction([
      this.prisma.attachment.delete({ where: { id: attachmentId } }),
      this.prisma.taskHistory.create({
        data: {
          taskId: attachment.taskId,
          actorId: userId,
          field: 'attachment_deleted',
          oldValue: attachment.filename,
        },
      }),
    ]);
    return deleted;
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/ apps/api/src/attachments/
git commit -m "feat: track description, criteria, and attachment changes in activity history"
```

---

## Task 6: Frontend - Types & API Client Updates

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Update types**

In `apps/web/src/lib/types.ts`:

Add `prefix`, `avatarUrl` to `Project` interface:

```typescript
export interface Project {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  avatarUrl: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  members?: Member[];
  _count?: {
    tasks: number;
  };
}
```

Add `prefix` to `CreateProjectPayload`:

```typescript
export interface CreateProjectPayload {
  name: string;
  description?: string;
  prefix: string;
}
```

Add `UpdateSettingsPayload`:

```typescript
export interface UpdateSettingsPayload {
  name?: string;
  description?: string;
  prefix?: string;
}
```

Add `taskKey` to `Task` interface:

```typescript
export interface Task {
  id: string;
  taskKey: string | null;
  title: string;
  // ... rest unchanged
}
```

Add `isEdited` to `Comment` interface:

```typescript
export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'username' | 'email'>;
  replies?: Comment[];
}
```

- [ ] **Step 2: Update API client**

In `apps/web/src/lib/api.ts`:

Add imports for new types:

```typescript
import type {
  // ... existing imports ...
  UpdateSettingsPayload,
} from './types';
```

Add new project endpoints:

```typescript
  getProjectByPrefix: (prefix: string) => request<Project>(`/projects/by-prefix/${prefix}`),
  updateProjectSettings: (id: string, data: UpdateSettingsPayload) =>
    request<Project>(`/projects/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadProjectAvatar: async (id: string, file: File): Promise<Project> => {
    const token = keycloak.token;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/projects/${id}/avatar`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<Project>;
  },
  removeProjectAvatar: (id: string) =>
    request<Project>(`/projects/${id}/avatar`, { method: 'DELETE' }),
```

Add comment update endpoint:

```typescript
  updateComment: (projectId: string, taskId: string, commentId: string, data: CreateCommentPayload) =>
    request<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/
git commit -m "feat: update types and API client for new features"
```

---

## Task 7: Frontend - Hooks Updates

**Files:**
- Modify: `apps/web/src/hooks/useProjects.ts`
- Modify: `apps/web/src/hooks/useComments.ts`

- [ ] **Step 1: Add project settings hooks**

In `apps/web/src/hooks/useProjects.ts`, add:

```typescript
import type { CreateProjectPayload, UpdateProjectPayload, UpdateSettingsPayload } from '../lib/types';

export function useProjectByPrefix(prefix: string) {
  return useQuery({
    queryKey: ['project-by-prefix', prefix],
    queryFn: () => api.getProjectByPrefix(prefix),
    enabled: !!prefix,
  });
}

export function useUpdateProjectSettings(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettingsPayload) => api.updateProjectSettings(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Settings updated');
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });
}

export function useUploadProjectAvatar(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadProjectAvatar(projectId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Avatar updated');
    },
    onError: () => {
      toast.error('Failed to upload avatar. Please try again.');
    },
  });
}

export function useRemoveProjectAvatar(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.removeProjectAvatar(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Avatar removed');
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });
}
```

- [ ] **Step 2: Add comment update hook**

In `apps/web/src/hooks/useComments.ts`, add:

```typescript
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
    onError: () => {
      toast.error('Failed to update comment. Please try again.');
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/
git commit -m "feat: add hooks for project settings and comment editing"
```

---

## Task 8: Frontend - Project Settings Page

**Files:**
- Create: `apps/web/src/pages/ProjectSettingsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Create ProjectSettingsPage**

Create `apps/web/src/pages/ProjectSettingsPage.tsx`:

```tsx
import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Upload, X, ImageIcon } from 'lucide-react';
import { useProject, useUpdateProjectSettings, useUploadProjectAvatar, useRemoveProjectAvatar } from '@/hooks/useProjects';
import { useProjectRole } from '@/hooks/useProjectRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ProjectSettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProject(projectId);
  const { canManage } = useProjectRole(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);
  const uploadAvatar = useUploadProjectAvatar(projectId);
  const removeAvatar = useRemoveProjectAvatar(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prefix, setPrefix] = useState('');
  const [prefixError, setPrefixError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form values when project loads
  if (project && !initialized) {
    setName(project.name);
    setDescription(project.description ?? '');
    setPrefix(project.prefix ?? '');
    setInitialized(true);
  }

  if (isLoading) return null;
  if (!project) return <p className="text-sm text-muted-foreground">Project not found.</p>;

  const validatePrefix = (value: string) => {
    const upper = value.toUpperCase();
    setPrefix(upper);
    if (upper && !/^[A-Z]{2,10}$/.test(upper)) {
      setPrefixError('Must be 2-10 uppercase letters');
    } else {
      setPrefixError('');
    }
  };

  const handleSave = () => {
    if (prefixError) return;
    updateSettings.mutate({
      name: name !== project.name ? name : undefined,
      description: description !== (project.description ?? '') ? description : undefined,
      prefix: prefix !== (project.prefix ?? '') ? prefix : undefined,
    });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Project Settings</h1>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle>Project Avatar</CardTitle>
          <CardDescription>Upload an image to represent this project</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="size-20">
            <AvatarImage src={project.avatarUrl ?? undefined} />
            <AvatarFallback className="text-2xl">
              {project.prefix?.slice(0, 2) ?? project.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canManage || uploadAvatar.isPending}
            >
              <Upload className="size-4 mr-1" />
              Upload
            </Button>
            {project.avatarUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAvatar.mutate()}
                disabled={!canManage || removeAvatar.isPending}
              >
                <X className="size-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task Key Prefix */}
      <Card>
        <CardHeader>
          <CardTitle>Task Key Prefix</CardTitle>
          <CardDescription>
            Tasks will be numbered {prefix || 'XX'}-1, {prefix || 'XX'}-2, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="prefix">Prefix</Label>
          <Input
            id="prefix"
            value={prefix}
            onChange={(e) => validatePrefix(e.target.value)}
            placeholder="e.g. PM, ACME"
            className="max-w-xs"
            disabled={!canManage}
          />
          {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
          {prefix && !prefixError && (
            <p className="text-xs text-muted-foreground">
              Preview: {prefix}-1, {prefix}-2, {prefix}-3...
            </p>
          )}
        </CardContent>
      </Card>

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-md"
              rows={3}
              disabled={!canManage}
            />
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending || !!prefixError}
        >
          Save Changes
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `apps/web/src/App.tsx`, add import and route:

```typescript
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
```

Add route after the members route:

```tsx
<Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
```

- [ ] **Step 3: Add Settings to sidebar nav**

In `apps/web/src/components/layout/AppSidebar.tsx`, import `Settings` icon:

```typescript
import {
  LayoutDashboard, ListTodo, Zap, Bug, Users, FolderKanban,
  ChevronLeft, ChevronRight, Settings,
} from 'lucide-react';
```

Add Settings to `PROJECT_NAV_ITEMS`:

```typescript
const PROJECT_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Backlog', icon: ListTodo, path: 'backlog' },
  { label: 'Sprints', icon: Zap, path: 'sprints' },
  { label: 'Bugs', icon: Bug, path: 'bugs' },
  { label: 'Members', icon: Users, path: 'members' },
  { label: 'Settings', icon: Settings, path: 'settings' },
];
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ProjectSettingsPage.tsx apps/web/src/App.tsx apps/web/src/components/layout/AppSidebar.tsx
git commit -m "feat: add project settings page with avatar upload and prefix config"
```

---

## Task 9: Frontend - Comment Editing UI

**Files:**
- Modify: `apps/web/src/components/tasks/CommentItem.tsx`
- Modify: `apps/web/src/components/tasks/CommentThread.tsx`

- [ ] **Step 1: Update CommentItem with edit support**

In `apps/web/src/components/tasks/CommentItem.tsx`, add edit functionality:

Add imports:

```typescript
import { Trash2, Reply, Pencil } from 'lucide-react';
import { useState } from 'react';
```

Update the `CommentItemProps` interface:

```typescript
interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  canManage: boolean;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  isReply?: boolean;
}
```

Update the component function signature and add editing state:

```typescript
export function CommentItem({
  comment,
  currentUserId,
  canManage,
  onReply,
  onDelete,
  onEdit,
  isReply = false,
}: CommentItemProps) {
  const canDelete = comment.authorId === currentUserId || canManage;
  const canEditComment = comment.authorId === currentUserId || canManage;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
```

In the render, after the timestamp `<span>`, add the "(edited)" tag:

```tsx
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
          {comment.isEdited && (
            <span className="text-xs text-muted-foreground italic">(edited)</span>
          )}
```

When `isEditing` is true, show an inline editor instead of the content div. Replace the `dangerouslySetInnerHTML` div with:

```tsx
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <div className="border rounded-md">
              <RichTextEditor
                content={editContent}
                onChange={setEditContent}
                placeholder="Edit comment..."
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => {
                onEdit(comment.id, editContent);
                setIsEditing(false);
              }}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                setEditContent(comment.content);
                setIsEditing(false);
              }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none mt-0.5 break-words text-sm [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:text-xs [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-xs [&_th]:bg-muted [&_th]:font-semibold"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }}
          />
        )}
```

Add Edit button to the action buttons area (before the delete button):

```tsx
          {canEditComment && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          )}
```

Add import for RichTextEditor:

```typescript
import { RichTextEditor } from './RichTextEditor';
```

- [ ] **Step 2: Wire up edit handler in CommentThread**

In `apps/web/src/components/tasks/CommentThread.tsx`, add the edit hook and handler:

Add import:

```typescript
import { useComments, useCreateComment, useCreateReply, useDeleteComment, useUpdateComment } from '@/hooks/useComments';
```

In the component, add:

```typescript
  const updateComment = useUpdateComment(projectId, taskId);

  const handleEdit = (commentId: string, content: string) => {
    updateComment.mutate({ commentId, content });
  };
```

Pass `onEdit={handleEdit}` to all `CommentItem` components.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/CommentItem.tsx apps/web/src/components/tasks/CommentThread.tsx
git commit -m "feat: add inline comment editing with (edited) tag"
```

---

## Task 10: Frontend - Activity Feed Redesign

**Files:**
- Rewrite: `apps/web/src/components/tasks/ActivityLog.tsx`
- Rewrite: `apps/web/src/components/tasks/ActivityEntry.tsx`

- [ ] **Step 1: Rewrite ActivityEntry with icon timeline and rich content**

Rewrite `apps/web/src/components/tasks/ActivityEntry.tsx`:

```tsx
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight, UserCheck, Milestone, Star, Pencil,
  MessageSquare, MessageSquareDiff, MessageSquareX,
  FileText, ListChecks, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskHistoryEntry, Member, Sprint } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

interface FieldConfig {
  icon: React.ElementType;
  color: string;
  bg: string;
}

const FIELD_CONFIG: Record<string, FieldConfig> = {
  status: { icon: ArrowRight, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  assigneeId: { icon: UserCheck, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  sprintId: { icon: Milestone, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  storyPoints: { icon: Star, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  title: { icon: Pencil, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
  comment_added: { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40' },
  comment_edited: { icon: MessageSquareDiff, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  comment_deleted: { icon: MessageSquareX, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
  description: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  acceptanceCriteria: { icon: ListChecks, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  attachment_added: { icon: Paperclip, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/40' },
  attachment_deleted: { icon: Paperclip, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const DEFAULT_CONFIG: FieldConfig = {
  icon: ArrowRight,
  color: 'text-gray-600',
  bg: 'bg-gray-100 dark:bg-gray-800',
};

function buildDescription(
  entry: TaskHistoryEntry,
  members?: Member[],
  sprints?: Sprint[],
): string {
  const { field, newValue, oldValue } = entry;
  switch (field) {
    case 'status':
      return `moved to ${newValue ? (STATUS_LABELS[newValue] ?? newValue) : 'unknown'}`;
    case 'assigneeId': {
      if (!newValue) return 'removed assignee';
      const member = members?.find((m) => m.userId === newValue);
      return `assigned to ${member?.user.username ?? newValue}`;
    }
    case 'sprintId': {
      if (!newValue) return 'removed from sprint';
      const sprint = sprints?.find((s) => s.id === newValue);
      return `moved to sprint ${sprint?.name ?? newValue}`;
    }
    case 'storyPoints':
      return !newValue ? 'cleared story points' : `set story points to ${newValue}`;
    case 'title':
      return `renamed task`;
    case 'comment_added':
      return 'added a comment';
    case 'comment_edited':
      return 'edited a comment';
    case 'comment_deleted':
      return 'deleted a comment';
    case 'description':
      return oldValue ? 'updated the description' : 'added a description';
    case 'acceptanceCriteria':
      return 'updated acceptance criteria';
    case 'attachment_added':
      return `uploaded ${newValue}`;
    case 'attachment_deleted':
      return `removed ${oldValue}`;
    default:
      return `changed ${field}`;
  }
}

function DiffCard({ oldValue, newValue }: { oldValue?: string | null; newValue?: string | null }) {
  if (!oldValue && !newValue) return null;
  return (
    <div className="mt-1.5 text-xs rounded-md border overflow-hidden">
      {oldValue && (
        <div className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through break-words">
          {oldValue.length > 200 ? oldValue.slice(0, 200) + '...' : oldValue}
        </div>
      )}
      {newValue && (
        <div className="px-2.5 py-1.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 break-words">
          {newValue.length > 200 ? newValue.slice(0, 200) + '...' : newValue}
        </div>
      )}
    </div>
  );
}

// Fields that show before/after diff cards
const DIFF_FIELDS = ['title', 'description', 'comment_edited', 'comment_added', 'comment_deleted'];

interface ActivityEntryProps {
  entry: TaskHistoryEntry;
  members?: Member[];
  sprints?: Sprint[];
  isLast?: boolean;
}

export function ActivityEntry({ entry, members, sprints, isLast = false }: ActivityEntryProps) {
  const config = FIELD_CONFIG[entry.field] ?? DEFAULT_CONFIG;
  const Icon = config.icon;
  const description = buildDescription(entry, members, sprints);
  const showDiff = DIFF_FIELDS.includes(entry.field);

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });
    } catch {
      return entry.createdAt;
    }
  })();

  return (
    <div className="flex gap-3 relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
      )}

      {/* Icon dot */}
      <div className={cn('relative z-10 flex items-center justify-center size-7 rounded-full shrink-0', config.bg)}>
        <Icon className={cn('size-3.5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-sm font-medium">{entry.actor.username}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{relativeTime}</span>
        </div>
        {showDiff && <DiffCard oldValue={entry.oldValue} newValue={entry.newValue} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite ActivityLog with date grouping and desc order**

Rewrite `apps/web/src/components/tasks/ActivityLog.tsx`:

```tsx
import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useTaskHistory } from '@/hooks/useTaskHistory';
import { ActivityEntry } from './ActivityEntry';
import type { Member, Sprint, TaskHistoryEntry } from '@/lib/types';

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

interface ActivityLogProps {
  projectId: string;
  taskId: string;
  members?: Member[];
  sprints?: Sprint[];
}

export function ActivityLog({ projectId, taskId, members, sprints }: ActivityLogProps) {
  const { data: history, isError, isLoading } = useTaskHistory(projectId, taskId);

  // Already descending from API; group by date
  const grouped = useMemo(() => {
    if (!history) return [];
    const groups: { label: string; entries: TaskHistoryEntry[] }[] = [];
    let currentLabel = '';
    for (const entry of history) {
      const label = formatDateGroup(entry.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [history]);

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load activity. Refresh to try again.
      </p>
    );
  }

  if (isLoading) return null;

  if (grouped.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.label}>
          <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            {group.label}
          </div>
          <div>
            {group.entries.map((entry, i) => (
              <ActivityEntry
                key={entry.id}
                entry={entry}
                members={members}
                sprints={sprints}
                isLast={i === group.entries.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/ActivityLog.tsx apps/web/src/components/tasks/ActivityEntry.tsx
git commit -m "feat: redesign activity feed with icon timeline, date groups, and rich diffs"
```

---

## Task 11: Frontend - Task Key Display

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`
- Modify: `apps/web/src/components/tasks/KanbanCard.tsx`

- [ ] **Step 1: Show taskKey in TaskDetailPage breadcrumb**

In `apps/web/src/pages/TaskDetailPage.tsx`, find the breadcrumb area where the task title is shown. Add the task key as a badge before the title. Find the section around line 282-310 with the breadcrumb/back button.

After the back button and before the title, add:

```tsx
        {task.taskKey && (
          <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {task.taskKey}
          </span>
        )}
```

- [ ] **Step 2: Show taskKey in TasksTable**

In `apps/web/src/components/tasks/TasksTable.tsx`, find the title column definition and prepend the taskKey:

Add a taskKey badge before the title in the cell render:

```tsx
<span className="font-mono text-xs text-muted-foreground mr-2">{row.original.taskKey}</span>
```

- [ ] **Step 3: Show taskKey in KanbanCard**

In `apps/web/src/components/tasks/KanbanCard.tsx`, add taskKey display at the top of the card:

```tsx
{task.taskKey && (
  <span className="text-xs font-mono text-muted-foreground">{task.taskKey}</span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx apps/web/src/components/tasks/TasksTable.tsx apps/web/src/components/tasks/KanbanCard.tsx
git commit -m "feat: display task keys in detail page, table, and kanban cards"
```

---

## Task 12: Frontend - Add Prefix to Create Project Dialog

**Files:**
- Modify: `apps/web/src/components/projects/CreateProjectDialog.tsx`

- [ ] **Step 1: Add prefix field to CreateProjectDialog**

Read the file first, then add a prefix input field between name and description fields. The prefix field should:

- Auto-uppercase on input
- Validate: 2-10 uppercase letters
- Show validation error if invalid
- Be required

Add state:

```typescript
const [prefix, setPrefix] = useState('');
const [prefixError, setPrefixError] = useState('');
```

Add the prefix input field in the form:

```tsx
<div className="space-y-2">
  <Label htmlFor="prefix">Task Key Prefix *</Label>
  <Input
    id="prefix"
    value={prefix}
    onChange={(e) => {
      const upper = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
      setPrefix(upper);
      if (upper && !/^[A-Z]{2,10}$/.test(upper)) {
        setPrefixError('Must be 2-10 uppercase letters');
      } else {
        setPrefixError('');
      }
    }}
    placeholder="e.g. PM, ACME"
  />
  {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
  {prefix && !prefixError && (
    <p className="text-xs text-muted-foreground">
      Tasks will be: {prefix}-1, {prefix}-2, ...
    </p>
  )}
</div>
```

Include `prefix` in the submit payload and reset it on success.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/projects/CreateProjectDialog.tsx
git commit -m "feat: add prefix field to create project dialog"
```

---

## Task 13: Backend - Serve Avatar Static Files & Main.ts Update

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Read and update main.ts**

Read `apps/api/src/main.ts` first, then add static file serving for the uploads directory so avatars can be served at `/api/uploads/avatars/...`.

```typescript
import { join } from 'path';
```

In the bootstrap function, before `app.listen()`:

```typescript
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/api/uploads' });
```

Note: Check if the app is already created as `NestExpressApplication`. If not, update the `NestFactory.create` call:

```typescript
const app = await NestFactory.create<NestExpressApplication>(AppModule);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat: serve static files for avatar uploads"
```
