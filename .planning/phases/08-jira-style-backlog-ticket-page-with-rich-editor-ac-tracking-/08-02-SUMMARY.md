---
phase: 08-jira-style-backlog-ticket-page-with-rich-editor-ac-tracking
plan: 02
subsystem: backend-comments-attachments
tags: [nestjs, comments, attachments, file-upload, multer, threading]
dependency_graph:
  requires: [08-01]
  provides: [CommentsModule, AttachmentsModule]
  affects: [AppModule, ProjectRolesGuard]
tech_stack:
  added: []
  patterns:
    - NestJS module pattern (PrismaModule import, controller+service providers)
    - Multer diskStorage with UUID filenames and per-task upload directories
    - Threaded comments via parentId self-relation with NoAction FK
    - Author/PM delete enforcement pattern shared by comments and attachments
key_files:
  created:
    - apps/api/src/comments/comments.module.ts
    - apps/api/src/comments/comments.controller.ts
    - apps/api/src/comments/comments.service.ts
    - apps/api/src/comments/comments.service.spec.ts
    - apps/api/src/comments/dto/create-comment.dto.ts
    - apps/api/src/comments/dto/create-reply.dto.ts
    - apps/api/src/attachments/attachments.module.ts
    - apps/api/src/attachments/attachments.controller.ts
    - apps/api/src/attachments/attachments.service.ts
    - apps/api/src/attachments/attachments.service.spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/auth/project-roles.guard.ts
decisions:
  - ProjectRolesGuard now attaches member.role to req.user.projectRole so downstream services can check the caller's project role without a second DB query
  - import type Response from express required in attachments controller due to isolatedModules + emitDecoratorMetadata constraint
  - req.params.taskId cast to string in diskStorage destination callback — Express params type is string | string[]
metrics:
  duration: ~5 minutes
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_created: 10
  files_modified: 2
---

# Phase 08 Plan 02: CommentsModule + AttachmentsModule Summary

**One-liner:** NestJS CommentsModule (threaded CRUD with author/PM delete) and AttachmentsModule (Multer diskStorage upload, UUID filenames, 10 MB limit, path-traversal-safe download).

## What Was Built

### Task 1: CommentsModule
- `CommentsService`: `findAll` (top-level comments with nested replies ordered by `createdAt`), `create`, `createReply` (validates parent belongs to same task), `delete` (author or PM only; replies deleted before parent to satisfy NoAction FK)
- `CommentsController`: routes under `projects/:projectId/tasks/:taskId/comments` — GET list, POST create, POST `:commentId/replies`, DELETE `:commentId`
- All endpoints guarded by `JwtAuthGuard` + `ProjectRolesGuard`
- `CommentsModule` imports `PrismaModule`
- DTOs: `CreateCommentDto`, `CreateReplyDto` with `@IsString()` + `@IsNotEmpty()`
- 6 unit tests covering create, findAll, delete (author, PM, non-author rejection, not-found)

### Task 2: AttachmentsModule
- `AttachmentsService`: `findAll`, `create`, `findOne`, `delete` (uploader or PM only; deletes from disk then DB; tolerates missing file)
- `AttachmentsController`: routes under `projects/:projectId/tasks/:taskId/attachments` — GET list, POST upload, GET `:attachmentId/download`, DELETE `:attachmentId`
- Multer `diskStorage` with `mkdirSync` in destination callback (prevents ENOENT), UUID + extension filenames, 10 MB `fileSize` limit
- `res.download(filePath, attachment.filename)` serves with original filename via Content-Disposition
- Download path built from DB-stored `storedName` and `taskId` only — never from request params (path traversal safe)
- `AttachmentsModule` imports `PrismaModule`
- 5 unit tests covering create, delete (uploader, PM, non-uploader rejection, not-found)
- Both modules registered in `AppModule`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ProjectRolesGuard did not expose member role to controllers**
- **Found during:** Task 1 implementation — controller needed `req.user.projectRole` to pass to service delete methods
- **Issue:** Guard fetched `member.role` internally but discarded it; no way for controller/service to know the caller's project role
- **Fix:** Added `request.user.projectRole = member.role` in `ProjectRolesGuard.canActivate()` after membership check
- **Files modified:** `apps/api/src/auth/project-roles.guard.ts`
- **Commit:** b65b2d7

**2. [Rule 1 - Bug] TypeScript errors in AttachmentsController**
- **Found during:** Task 2 verification (`tsc --noEmit`)
- **Issues:** (a) `req.params.taskId` typed as `string | string[]` in Express but `join()` expects `string`; (b) `Response` from express cannot be used as value import with `isolatedModules + emitDecoratorMetadata`
- **Fix:** Cast `req.params.taskId as string` in diskStorage destination; change `import { Response }` to `import type { Response }`
- **Files modified:** `apps/api/src/attachments/attachments.controller.ts`
- **Commit:** 9db1b9e

## Known Stubs

None — all service methods are fully implemented with Prisma queries.

## Threat Flags

All threats from the plan's threat model are mitigated:
- T-08-04/T-08-05: Author/uploader or PM delete checks implemented in both services
- T-08-06: Download path built from DB fields only (`storedName`, `taskId`)
- T-08-07: `limits.fileSize: 10 * 1024 * 1024` in FileInterceptor
- T-08-08/T-08-09: All endpoints behind `JwtAuthGuard + ProjectRolesGuard`

## Self-Check: PASSED

- [x] `apps/api/src/comments/comments.module.ts` — exists
- [x] `apps/api/src/comments/comments.controller.ts` — exists
- [x] `apps/api/src/comments/comments.service.ts` — exists
- [x] `apps/api/src/attachments/attachments.module.ts` — exists
- [x] `apps/api/src/attachments/attachments.controller.ts` — exists
- [x] `apps/api/src/attachments/attachments.service.ts` — exists
- [x] `apps/api/src/app.module.ts` — contains `CommentsModule` and `AttachmentsModule`
- [x] Commit b65b2d7 — Task 1 (CommentsModule)
- [x] Commit 9db1b9e — Task 2 (AttachmentsModule + AppModule)
- [x] `tsc --noEmit` exits 0
- [x] `vitest run` — 57 tests pass across 11 test files
