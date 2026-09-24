# Tasks: project-field-config

## 1. DB: fieldConfig column [req-1]
- [x] 1.1 [db] Add `fieldConfig Json?` to `Project` in `apps/api/prisma/schema.prisma` (after `workflowLayout`)
- [x] 1.2 [db] Write migration `apps/api/prisma/migrations/20260924000000_add_project_field_config/migration.sql` — `ALTER TABLE "Project" ADD COLUMN "fieldConfig" JSONB;`
- [x] 1.3 [db] Regenerate Prisma client (`npx prisma generate` in apps/api — no pnpm prisma script)
Verify: `pnpm --filter @pm/api build` (client typechecks with new field)

## 2. API: accept + return fieldConfig [req-1, req-2]
- [x] 2.1 [backend] Add optional `fieldConfig?: Prisma.InputJsonValue` (`@IsOptional() @IsObject()`) to `UpdateProjectDto` (`apps/api/src/projects/dto/update-project.dto.ts`)
- [x] 2.2 [backend] Persist `fieldConfig` in `projects.service.ts:162` `update()` data block (spread only when provided, like existing fields)
- [x] 2.3 [backend] Confirm `findOne` returns it (uses `include`, so no change) — no code, assert in test
- [x] 2.4 [test] `apps/api/src/projects/projects.service.spec.ts`: update with `fieldConfig` persists + omitted when absent (2 tests); route permission via existing `@RequirePermission('projectSettings','update')`
Verify: `pnpm --filter @pm/api test -- projects.service`

## 3. Web: shared field defs + helper [req-5]
- [x] 3.1 [frontend] New `apps/web/src/lib/fieldConfig.ts`: `FieldKey` type, `FIELD_DEFS` array (`{key,label,required?}` for the 9 fields — taskType `required:true`), `FieldConfig` type, `isFieldVisible(cfg, key): boolean` (missing cfg/key ⇒ true)
- [x] 3.2 [frontend] Add `fieldConfig?` to `Project` type + `UpdateProjectPayload` — actual location `apps/web/src/lib/types.ts` (spec said api.ts); imported `FieldConfig`
- [x] 3.3 [test] `apps/web/src/lib/fieldConfig.test.ts`: unset/null⇒true, missing key⇒true, false⇒false, true⇒true (4 tests green; 5 pre-existing unrelated suite failures out of scope, confirmed on clean tree)
Verify: `pnpm --filter @pm/web test -- fieldConfig`

## 4. Web: Configure Fields dialog [req-3, req-4]
- [x] 4.1 [frontend] New `apps/web/src/components/settings/ConfigureFieldsDialog.tsx` — reuses `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogBody`/`DialogFooter`, `Switch`, `Button`, `Badge`, `Label`, `Alert variant=destructive`. Rows from `FIELD_DEFS`; local toggle state seeded from `project.fieldConfig`, reset on open
- [x] 4.2 [frontend] Required badge on `taskType`; when a required field is toggled off, inline `Alert` warning; Save stays enabled
- [x] 4.3 [frontend] Save → `useUpdateProject().mutate({ fieldConfig })` storing only hidden keys; `isPending` disables buttons + spinner; onError toast; onSuccess closes (hook already invalidates `['project',id]`)
- [x] 4.4 [frontend] Cancel discards local state (no PATCH)
Verify: `/devspec-verify project-field-config` (agent-browser: dialog opens from General tab, 9 rows + switches, required-off warning appears, Save persists + reopen reflects, styling non-plain)

## 5. Web: General-tab entry point [req-2, req-3]
- [x] 5.1 [frontend] In `ProjectSettingsPage.tsx` General tab, added "Task fields" `<Card>` with `Button variant=outline` "Configure Fields", `disabled={!canManage}`, mounting `ConfigureFieldsDialog` (passes `project.fieldConfig`)
Verify: `/devspec-verify project-field-config` (button present in General tab, disabled without manage permission)

## 6. Web: apply visibility in task forms [req-5]
- [x] 6.1 [frontend] `CreateTaskDialog.tsx`: reads `useProject(projectId).fieldConfig`; gated the 5 fields present here (taskType, storyPoints, priority, assignee, sprint) on `isFieldVisible`; taskType required check + payload now conditional (the 4 date fields are not in this dialog)
- [x] 6.2 [frontend] `TaskDetailPage.tsx`: gated all 9 field blocks on `isFieldVisible` (Planned/Actual groups gate each picker + hide the group when both hidden)
- [x] 6.3 [test] `apps/web/src/components/tasks/CreateTaskDialog.test.tsx` (new, 4 tests green): unset⇒all 5 render; hidden sprint absent; hidden taskType⇒submit ok, no required error, taskTypeId undefined; visible taskType⇒blocks empty submit
Verify: `pnpm --filter @pm/web test -- CreateTaskDialog`

## 7. Visual sign-off [req-3, req-4, req-5]
- [ ] 7.1 MANUAL: BA approves screenshot — dialog (all states) + a task create form with fields hidden, against `mockups/configure-fields-dialog.html`
Verify: MANUAL: BA approves the devspec-verify screenshots
