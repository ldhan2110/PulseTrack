# Design: project-field-config

## Approach
Store visibility as a JSON map on the project (`Project.fieldConfig`), mirroring the existing `Project.workflowLayout Json?` precedent. No new table, no relation — a project has exactly one field config, read on every task-form render via the already-fetched project object.

The map is `{ <fieldKey>: boolean }`. **Absent config or absent key = visible** (default-on), so existing projects need no backfill and new fields added later default to visible.

Config is a **UI concern only**: the API keeps accepting every task field. Hiding a field just stops the form from rendering it (and drops its client-side required check). This keeps the change small and avoids coupling task validation to project config.

## Data shape
```ts
type FieldKey =
  | 'taskType' | 'assignee' | 'priority' | 'sprint' | 'storyPoints'
  | 'plannedStartDate' | 'plannedEndDate' | 'actualStartDate' | 'actualEndDate';
type FieldConfig = Partial<Record<FieldKey, boolean>>;   // missing/absent => visible
```
A shared `FIELD_DEFS` constant (key, label, required?) drives both the dialog rows and the `isFieldVisible(config, key)` helper, so the field list lives in one place.

## Architecture

```
Project Settings (General tab)
  └─ [Configure Fields] button (canManage) ─► ConfigureFieldsDialog
                                                 │ local toggles
                                                 ▼ Save
                              PATCH /projects/:projectId { fieldConfig }
                                                 │ RequirePermission(projectSettings, update)
                                                 ▼
                                    projects.service.update ─► Project.fieldConfig (JSONB)

Task forms read the same project object:
  useProject(projectId).fieldConfig
        │
        ├─► CreateTaskDialog  ─ isFieldVisible(cfg, key) ? render field : skip (+ skip its required check)
        └─► TaskDetailPage    ─ isFieldVisible(cfg, key) ? render field : skip
```

## Impact Area

### Decision Defaults
| Gray area | Default | Why |
|-----------|---------|-----|
| Absent config / absent key | Treat as **visible** | No backfill; safe for existing projects + future fields |
| Hidden required field (Ticket type) saved value | Save **null/omit** (no fallback ticket type) | Column is nullable; picking a default is out of scope |
| Backend enforcement of hidden fields | **None** — API still accepts all fields | Config is UI-only; avoids coupling task validation to project |
| Who can edit config | `canManage` (`projectSettings:update`), owner rules as existing `update` | Reuse the endpoint's existing guard, no new permission |
| Where hiding applies | `CreateTaskDialog` + `TaskDetailPage` only | Board columns/filters explicitly out of scope v1 |
| Field currently holding data, then hidden | Data kept in DB, just not shown/edited | Non-destructive; re-showing restores editing |
| Config value type in JSON | Store only explicitly-set keys | Smaller blob; default-on covers the rest |

### Blast Radius
- `apps/api/prisma/schema.prisma` — add `fieldConfig Json?` to `Project` (+ migration file).
- `apps/api/src/projects/dto/update-project.dto.ts` — add optional `fieldConfig`.
- `apps/api/src/projects/projects.service.ts:162` `update()` — persist `fieldConfig` (currently spreads specific fields).
- `apps/web/src/lib/api.ts` — add `fieldConfig` to the `Project` type + include in `updateProject` payload.
- `apps/web/src/pages/ProjectSettingsPage.tsx` — General tab: add the "Task fields" card + button + dialog mount.
- **New** `apps/web/src/components/settings/ConfigureFieldsDialog.tsx` — the dialog.
- **New** `apps/web/src/lib/fieldConfig.ts` — `FIELD_DEFS` + `isFieldVisible` helper (shared by dialog + task forms).
- `apps/web/src/components/tasks/CreateTaskDialog.tsx` — gate each field render + its required check on `isFieldVisible`.
- `apps/web/src/pages/TaskDetailPage.tsx` — gate each field render on `isFieldVisible`.

### Risk tags
- **Reversibility**: high — additive column, UI-gated; removing config restores all fields.
- **Required-field risk**: hiding Ticket type lets tasks be created without one — intended, warned in UI. `CreateTaskDialog` currently hard-requires `taskTypeId`; that check must become conditional or hidden-config tasks can't be created.
- **Low** data risk: no writes to existing rows, no destructive ops.

## Rejected approaches
- **Separate `ProjectFieldConfig` table (1:1)** — matches `AiConfig`/`WikiConfig` style but overkill for a small static map; `workflowLayout Json?` is the closer, lighter precedent. Rejected for simplicity.
- **Backend enforcement of visibility** (reject hidden fields at API) — couples task validation to project config, bigger blast radius, no v1 need. Rejected.
- **Per-field default value when hidden** — extra UI + storage; out of scope. Rejected.
