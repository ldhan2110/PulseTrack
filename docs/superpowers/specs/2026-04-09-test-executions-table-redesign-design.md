# Test Executions Page — Table Redesign

**Date:** 2026-04-09
**Status:** Approved

## Summary

Replace the card grid layout on the Test Executions page with a sortable, filterable table using `@tanstack/react-table` — matching the existing `TestCasesTable` and `BugsTable` patterns.

## Columns

| Column   | Sortable | Content                                                    |
|----------|----------|------------------------------------------------------------|
| Name     | Yes      | Clickable blue text, navigates to execution detail         |
| Status   | Yes      | Badge: Pending (yellow), In Progress (blue), Completed (green) |
| Assignee | Yes      | Assignee name text                                         |
| Sprint   | Yes      | Sprint name, or `—` if none                                |
| Progress | Yes (%)  | Stacked color progress bar + percentage number             |
| Results  | No       | Compact colored counts: Pass, Fail, Blocked, Skip, Not Run |
| Created  | Yes      | Formatted date (e.g. "Apr 7, 2026")                       |

## Filters

Located above the table in a horizontal bar:

- **Search** — text input, filters by execution name (existing behavior)
- **Status** — select dropdown: All / Pending / In Progress / Completed (existing behavior)
- **Assignee** — new select dropdown populated from `useMembers`, filters by assigneeId
- **Sprint** — new select dropdown populated from execution data, filters by sprintId

## Progress Bar

Stacked horizontal bar showing proportional segments for each result status:
- Pass (green `#22c55e`), Fail (red `#ef4444`), Blocked (amber `#f59e0b`), Skip (gray `#6b7280`), Not Run (dark gray `#374151`)
- Percentage number displayed to the right of the bar

## Results Column

Compact inline display with colored counts:
- `✓9` (pass, green), `✗2` (fail, red), `⊘1` (blocked, amber), `–3` (not run, gray)
- Skip count shown only if > 0

## Components Changed

### `ExecutionList.tsx` — Full Rewrite

- Replace card grid with `@tanstack/react-table` table
- Reuse `SortHeader` pattern from `TestCasesTable`
- Use shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` components
- Define column definitions with `ColumnDef<TestExecution>`
- Row click navigates to `/projects/:projectPrefix/test-executions/:id` (or calls `onSelectExecution`)
- Keep existing empty state UI (ClipboardList icon + message)

### `TestExecutionsPage.tsx` — Filter Updates

- Add `assigneeFilter` and `sprintFilter` state
- Add Assignee and Sprint `<Select>` dropdowns to filter bar
- Move filtering into `@tanstack/react-table` column filters instead of `useMemo`
- Pass sorting and columnFilters state to the table component

## What Stays the Same

- Empty state (no executions message)
- Row click navigates to execution detail page
- `+ New Execution` button and `CreateExecutionDialog`
- Runner mode and detail view conditional rendering in `TestExecutionsPage`
- `useTestExecutions` and `useTestExecution` hooks unchanged

## Technical Notes

- Follow `TestCasesTable.tsx` as the primary reference for table structure
- Status badge styles reuse the existing `STATUS_BADGE` mapping from `ExecutionList.tsx`
- Result colors reuse the existing `RESULT_COLORS` mapping
- `formatDate` helper stays the same
