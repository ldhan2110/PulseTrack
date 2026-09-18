# Design: export-excel-sanitize-parent

## Architecture

Client → GET export → TasksController.exportExcel → TasksService.exportExcel
                                                        ├─ prisma.task.findMany (parents + children include)
                                                        ├─ flatten rows  → attach parentKey per row
                                                        ├─ sanitizeDescription(html) → plain text
                                                        └─ ExcelJS Workbook → buffer

Only `TasksService.exportExcel` (`apps/api/src/tasks/tasks.service.ts:618`) changes. No new components, no new endpoint.

## Approach

### 1. Description sanitization
Add a private helper `sanitizeDescription(html: string): string` on `TasksService`:
- Strip tags with the repo's existing pattern `/<[^>]*>/g` (already used at `tasks.service.ts:384` and `comments.service.ts:301`).
- Decode the common HTML entities the rich-text editor emits: `&amp; &lt; &gt; &quot; &#39; &nbsp;`.
- Collapse runs of whitespace to a single space and trim, so block tags that became gaps don't leave ragged cells.

Apply it at the row build (`tasks.service.ts:745`): `description: this.sanitizeDescription(t.description ?? '')`.

**Why local helper, not a library:** the repo already strips HTML inline with a bare regex in two places and pulls in no HTML-parsing dep. A ~6-line strip+decode keeps that convention (see `patterns.md`) and covers the editor's actual output. Full entity coverage isn't needed — only the entities the editor produces.

### 2. Parent Task Key column
The flatten loop (`tasks.service.ts:688-697`) already holds the parent `task` in scope when it pushes each child, so the parent key needs no extra Prisma include. Attach it while flattening:
- parent row → `parentKey: ''`
- child row → `parentKey: task.taskKey ?? ''`

Add the column definition (`tasks.service.ts:704`) as the **second** column, right after Task Key:
`{ header: 'Parent Task Key', key: 'parentKey', width: 16 }`
and set `parentKey` in the `addRow` object (`tasks.service.ts:742`). Header styling and per-cell borders already apply to all columns via `headerRow.eachCell` / `row.eachCell`, so no styling change.

## Rejected approaches
- **Sanitize on write / store plain text** — rejected: changes stored data and other read paths; the description is legitimately rich HTML elsewhere. Sanitization belongs at export only.
- **Add a real HTML-to-text dependency (e.g. `html-to-text`)** — rejected as over-engineering for one cell; repo convention is inline regex strip.
- **Include parent relation in the child Prisma query for the key** — unnecessary; the flatten loop already has the parent in scope.

## Impact Area

### Decision Defaults
| Gray area | Default |
|-----------|---------|
| Which HTML entities to decode | The set the rich-text editor emits: `&amp; &lt; &gt; &quot; &#39; &nbsp;`. Leave any other entity as-is rather than pull a full table. |
| Whitespace after tag strip | Collapse runs of whitespace to one space, trim ends. |
| Parent Task Key column position | Second column, immediately after Task Key. |
| Parent Task Key value for parent rows | Empty string. |
| Sub-task whose parent has no taskKey | Empty string (same fallback as Task Key). |

### Blast Radius
- **Direct:** `TasksService.exportExcel` — the only method edited.
- **Callers:** `TasksController.exportExcel` → frontend `api.exportTasks` → `ExportTasksDialog`. None change; the response is still an xlsx buffer, only cell content and column count differ.
- **Other exports** (test cases, bugs, WBS `exportWbs.ts`) are separate code paths — untouched.

### Risk
- **Low / reversible.** Output-only change to one method; no schema, no contract, no stored data touched. Worst case a cell renders slightly differently — no data loss.
