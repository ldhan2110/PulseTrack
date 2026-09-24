# Tasks: task-type-field

## 1. Schema: ProjectTaskCategory + Task FK [req-1]
- [x] 1.1 [db] Add `model ProjectTaskCategory { id, projectId, name, position, isActive, createdAt }` to `apps/api/prisma/schema.prisma`, mirroring `ProjectTaskType` (`@@unique([projectId,name])`, `@@index([projectId])`, `project` relation `onDelete: Cascade`)
- [x] 1.2 [db] Add `taskCategoryId String?` + relation `taskCategory ProjectTaskCategory? @relation(fields:[taskCategoryId], references:[id], onDelete: SetNull)` to `Task`; add `taskCategories ProjectTaskCategory[]` to `Project`
- [x] 1.3 [db] Generate forward migration `apps/api/prisma/migrations/*/migration.sql` (additive: create table + add nullable column + FK). No DROP, no backfill.
Verify: `pnpm --filter @pm/api exec prisma validate` and migration applies clean on a scratch DB (`prisma migrate deploy`); `ProjectTaskType`/`Task.taskTypeId` unchanged.

## 2. Seed defaults + service [req-2]
- [x] 2.1 [backend] Add `DEFAULT_TASK_CATEGORIES` (11 values in order) near `DEFAULT_TASK_TYPES` in `apps/api/src/projects/projects.service.ts`
- [x] 2.2 [backend] In `create()` tx, `tx.projectTaskCategory.createMany` the 11 defaults (mirror the task-types block at `:68`)
- [x] 2.3 [backend] `getTaskCategories(projectId)`: return ordered by `position`; if the project has zero rows, seed the 11 defaults first, then return (lazy-seed)
- [x] 2.4 [test] `apps/api/src/projects/projects.service.spec.ts`: create seeds 11 categories; getTaskCategories on an empty project seeds then returns 11
Verify: `pnpm --filter @pm/api test -- projects.service`

## 3. Task-category API [req-3]
- [x] 3.1 [backend] `set-task-categories.dto.ts` mirroring `set-task-types.dto.ts` (`{id?, name, isActive}[]`)
- [x] 3.2 [service] `setTaskCategories(projectId, rows)` in projects.service — same diff logic as `setTaskTypes` (`:289-334`) on the `projectTaskCategory` delegate; reject when no active non-empty row
- [x] 3.3 [backend] Add `GET` + `PUT /projects/:projectId/task-categories` to `apps/api/src/projects/projects.controller.ts`, mirroring the task-types routes + guards
- [x] 3.4 [test] projects.service.spec: setTaskCategories add/rename/reorder/soft-delete; empty-active payload rejected
Verify: `pnpm --filter @pm/api test -- projects.service`

## 4. Web plumbing: api client + fieldConfig [req-4]
- [x] 4.1 [frontend] Add `getTaskCategories(projectId)` + `setTaskCategories(projectId, rows)` to `apps/web/src/lib/api.ts` (mirror the task-types methods); add `TaskCategory` type to `src/lib/types.ts`
- [x] 4.2 [frontend] Add `'taskCategory'` to `FieldKey` and a `{ key:'taskCategory', label:'Task type', required:true }` entry to `FIELD_DEFS` in `apps/web/src/lib/fieldConfig.ts`
- [x] 4.3 [test] `apps/web/src/lib/fieldConfig.test.ts`: `taskCategory` present in `FIELD_DEFS`, required, default-visible via `isFieldVisible`
Verify: `pnpm --filter @pm/web test -- fieldConfig`

## 5. Task Type select on task forms [req-4]
- [x] 5.1 [frontend] In `apps/web/src/components/tasks/CreateTaskDialog.tsx`, add a required Task Type `<Select>` (reuse `Select*` from `src/components/ui/select.tsx`) beside the Ticket Type select; options from `api.getTaskCategories`; gate render on `isFieldVisible(fieldConfig,'taskCategory')`
- [x] 5.2 [frontend] Add `taskCategoryId` required validation mirroring `taskTypeId` (error "Task type is required"); skip validation when the field is hidden; include `taskCategoryId` in the create payload
- [x] 5.3 [frontend] In `apps/web/src/pages/TaskDetailPage.tsx`, add the same gated Task Type select, wired to the task update
- [x] 5.4 [test] `apps/web/src/components/tasks/CreateTaskDialog.test.tsx`: visible → submit without task type blocked; hidden → not rendered, submit allowed
Verify: `pnpm --filter @pm/web test -- CreateTaskDialog`

## 6. Merged Configure Fields modal [req-5]
- [x] 6.1 [frontend] Extract a shared `FieldValueEditor` (`apps/web/src/components/settings/FieldValueEditor.tsx`) from `TaskTypesCard` internals — rows with reorder/rename/deactivate/restore/add + per-section Save; props `{ query, mutation, addLabel, canManage }`
- [x] 6.2 [frontend] In `apps/web/src/components/settings/ConfigureFieldsDialog.tsx`, give value-backed fields (`taskType`, `taskCategory`) an expand chevron + `N values` badge; render `FieldValueEditor` inline (Ticket type → task-types query/mutation, Task type → task-categories)
- [x] 6.3 [frontend] Keep required switches locked ON; `Save visibility` (fieldConfig PATCH) disabled while any value section is dirty
- [x] 6.4 [frontend] Remove `<TaskTypesCard>` from `apps/web/src/pages/ProjectSettingsPage.tsx` (and its import); delete `TaskTypesCard.tsx` once its editor logic lives in `FieldValueEditor`
- [x] 6.5 [test] `apps/web/src/components/settings` unit: required field switch disabled; expanding Task type shows editor; empty active name disables that section's Save
Verify: `pnpm --filter @pm/web test -- ConfigureFields` then `/devspec-verify task-type-field` (agent-browser: merged modal both editors + toggles, Task Type select required on create form, per-section save, non-plain styling)
