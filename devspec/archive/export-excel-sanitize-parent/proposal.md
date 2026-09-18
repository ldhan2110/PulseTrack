# Proposal: export-excel-sanitize-parent

## Why
The Backlog "Export Excel" feature (`TasksService.exportExcel`, `apps/api/src/tasks/tasks.service.ts:618`) writes the task **Description** cell as raw HTML — a task described in the rich-text editor exports as `<p>Fix &amp; ship</p>` instead of the readable text `Fix & ship`. The exported sheet is meant for humans reading in Excel, so the cell must contain plain, readable text.

Separately, the export flattens parent tasks and their sub-tasks into one sheet but gives no column showing which parent a sub-task belongs to. A reader can't tell the hierarchy from the sheet.

## What it delivers
1. **Readable Description column** — HTML tags stripped and common HTML entities decoded, so the cell shows the plain text a human wrote.
2. **New "Parent Task Key" column** — placed immediately after "Task Key". Blank for parent tasks; for a sub-task it holds the parent's task key (e.g. `PROJ-1`).

## Scope
**In**
- `TasksService.exportExcel` only: description sanitization + one new column.

**Out**
- No change to the export dialog, `api.ts`, DTOs, DB schema, or any other export (test cases, bugs, WBS).
- No change to how descriptions are stored — sanitization is display-only, at export time.
- No new HTML-parsing dependency; use a small local strip+decode matching the repo's existing `/<[^>]*>/g` convention.
