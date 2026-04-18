# Sub-task Filtering & Saved Queries

## Overview

Two features for the task list page:
1. **Sub-task filtering** — filters apply to sub-tasks, not just parent tasks. Matching sub-tasks are promoted to top-level rows.
2. **Saved queries** — users can save filter presets per entity type, set a default, with a hardcoded fallback that excludes closed statuses.

## Scope

Applies to all pages using `TasksTable` (BacklogPage, SprintBoardPage). The same saved query system extends to BugsPage (shared `SavedFilter` model, `entityType` discriminator).

---

## Feature 1: Sub-task Filtering

### Problem

Current `TasksTable` only filters parent-level rows. Sub-tasks are rendered as expandable child rows outside TanStack's filtering pipeline. Users cannot find sub-tasks by status, assignee, sprint, or search.

### Solution: Flatten & Promote

A `useMemo` in `TasksTable` transforms the `tasks` array before passing it to TanStack Table.

**When no filters are active:** pass original hierarchical array unchanged (normal parent + expandable children).

**When any filter is active:** for each parent task:
- Parent matches all filters -> include parent as-is, but filter its `children` array to only include matching children
- Parent doesn't match but some children do -> promote each matching child to a top-level row
- Neither parent nor children match -> exclude entirely

### Filter matching

A helper function checks a single task against current filter state:

```typescript
function matchesFilters(
  task: Task,
  columnFilters: ColumnFiltersState,
  globalFilter: string,
): boolean
```

Reuses the same logic as existing `statusFilterFn`, `assigneeFilterFn`, `sprintFilterFn`, `progressFilterFn` — applied manually before TanStack processes the data.

### Promoted sub-task appearance

- Shown as a top-level row like any other task
- Title cell shows breadcrumb prefix: `PM-5 > PM-5-1 Fix login`
- No expand/collapse chevron (sub-tasks have no children, max depth is 1)

### Files changed

| File | Change |
|------|--------|
| `apps/web/src/components/tasks/TasksTable.tsx` | Add `useMemo` flatten logic, breadcrumb rendering for promoted sub-tasks |
| `apps/web/src/components/tasks/TaskFilters.tsx` | Export filter-matching utility function |

---

## Feature 2: Saved Queries

### Data Model

New Prisma model:

```prisma
model SavedFilter {
  id         String   @id @default(cuid())
  userId     String
  projectId  String
  entityType String   // "task" | "bug"
  name       String
  filters    Json
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId, entityType, name])
  @@index([userId, projectId, entityType])
}
```

### Filter JSON shape

```typescript
interface SavedFilterData {
  statuses?: string[];      // workflowStatusId[]
  assignees?: string[];     // userId[] | ["unassigned"]
  sprint?: string;          // sprintId | "none" | ""
  progress?: string[];      // ["0", "1-49", "50-99", "100"]
  search?: string;
}
```

### API Endpoints

All scoped to authenticated user — users can only see/modify their own.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:projectId/saved-filters?entityType=task` | List user's saved filters |
| `POST` | `/projects/:projectId/saved-filters` | Create a saved filter |
| `PATCH` | `/projects/:projectId/saved-filters/:id` | Update name, filters, or isDefault |
| `DELETE` | `/projects/:projectId/saved-filters/:id` | Delete a saved filter |

When `isDefault` is set to `true` via PATCH, the service automatically unsets `isDefault` on any other filter for the same user + project + entityType.

### Default behavior

1. Page loads -> fetch user's saved filters for this entityType + projectId
2. If a `isDefault` filter exists -> apply its filters
3. If no default -> apply hardcoded default: exclude all workflow statuses where `isClosed === true`
4. Users can save a "Show All" query with no status filter to see everything including Done

### Saved Queries UI

Dropdown at the left end of the filter bar:

```
[Saved Queries v] [Search...] [Status] [Assignee] [Sprint] [Progress] [Clear]
```

**Dropdown contents:**
- List of saved queries with star icon on the default
- Each row: name, star toggle (set as default), trash icon on hover (delete)
- Bottom: "Save current filters..." (inline name input)

**State indicator:** when user modifies filters after loading a saved query, the dropdown label shows "Modified" to indicate unsaved changes.

### Frontend architecture

**New hook: `useSavedFilters(projectId, entityType)`**
- Returns: `{ filters, isLoading, create, update, remove, setDefault }`
- Query key: `['saved-filters', projectId, entityType]`

**New component: `SavedQueryDropdown`**
- Lives in parent page alongside `TaskFilters`, not inside `TasksTable`
- Controls which filters are applied to the table

**TasksTable change:** new optional prop `initialFilters?: ColumnFiltersState`
- Parent page resolves the default (saved or hardcoded) and passes it in
- Table initializes `columnFilters` from this prop

### Files changed

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `SavedFilter` model, relations on User and Project |
| `apps/api/src/saved-filters/` | New module: controller, service, DTOs |
| `apps/web/src/hooks/useSavedFilters.ts` | New hook for CRUD + default resolution |
| `apps/web/src/components/tasks/SavedQueryDropdown.tsx` | New dropdown component |
| `apps/web/src/pages/BacklogPage.tsx` | Integrate SavedQueryDropdown + initialFilters |
| `apps/web/src/pages/SprintBoardPage.tsx` | Integrate SavedQueryDropdown + initialFilters |
| `apps/web/src/lib/api.ts` | Add saved-filter API methods |
| `apps/web/src/lib/types.ts` | Add SavedFilter type |

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sub-task filter match behavior | Promote to flat top-level row | User preference — cleaner than showing non-matching parents |
| Saved query scope | Per entity type (task/bug) | Tasks and bugs have different filter dimensions |
| Default fallback | Hardcoded, exclude closed statuses | Simple, no admin config needed, Done hidden by default |
| Storage | Backend (Prisma model) | Multi-user PM tool, cross-device portability |
| UI pattern | Dropdown at filter bar start | Familiar pattern (Jira/Linear), space-efficient |
