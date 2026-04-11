# Import Bugs from Excel — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Overview

Add an "Import from Excel" feature for bugs, following the same pattern as the existing `ImportTestCasesDialog`. Users upload a `.xlsx` file, preview parsed rows with validation, then bulk-import into the project.

## Schema Change

Add `preconditions` (String?, max 5000 chars) to the `Bug` model in `apps/api/prisma/schema.prisma`. Update `CreateBugDto`, `UpdateBugDto`, and the `BugsService` to support this field. Add the field to the `CreateBugDialog` UI.

## Excel Column Mapping

| Excel Column | Bug Field | Notes |
|---|---|---|
| Title | `title` | Required, min 3 chars |
| Pre-conditions | `preconditions` | New field |
| Environment | `environment` | |
| Steps to reproduce | `reproSteps` | Parse numbered steps into `{position, content}[]` |
| Actual Result | `actualResult` | |
| Expected Result | `expectedResult` | |
| Severity / Priority | `severity` | Minor→LOW, Moderrate/Medium→MEDIUM, Major→HIGH, Critical→CRITICAL |
| Status | `workflowStatusId` | Match by name (case-insensitive) against project workflow statuses; fallback to project default |
| No., Work Type, UI | ignored | |

### Header Mapping (fuzzy)

Multiple header names map to the same field:
- `title`, `name`, `bug title` → `title`
- `pre-conditions`, `preconditions`, `prerequisites` → `preconditions`
- `environment`, `env` → `environment`
- `steps to reproduce`, `repro steps`, `steps` → `reproSteps`
- `actual result`, `actual` → `actualResult`
- `expected result`, `expected` → `expectedResult`
- `severity`, `priority` → `severity`
- `status` → `statusName`

### Severity Mapping

Case-insensitive, handles common typos:
- `critical` → `CRITICAL`
- `major`, `high` → `HIGH`
- `medium`, `moderate`, `moderrate` → `MEDIUM`
- `minor`, `low` → `LOW`

## Backend

### New Endpoint: `POST /projects/:projectId/bugs/bulk-import`

**Permission:** `RequirePermission('bugs', 'create')`

### DTO: `BulkImportBugsDto`

```typescript
class BulkImportBugItemDto {
  title: string;           // required, min 3, max 200
  preconditions?: string;  // max 5000
  description?: string;    // max 5000
  severity: BugSeverity;   // required
  environment?: string;    // max 1000
  expectedResult?: string; // max 5000
  actualResult?: string;   // max 5000
  statusName?: string;     // resolved to workflowStatusId by name
  reproSteps?: { position: number; content: string }[];
}

class BulkImportBugsDto {
  items: BulkImportBugItemDto[]; // max 500
}
```

### Service: `BugsService.bulkImport()`

Single `$transaction`:
1. Fetch all BUG workflow statuses for the project
2. Build a case-insensitive name→id map
3. Find the default BUG workflow status
4. For each item:
   - Increment `bugSeq` on the project (atomically)
   - Generate `bugKey`
   - Resolve `statusName` to `workflowStatusId` (fallback to default)
   - Create the bug record
   - Create reproSteps if present
5. Return `{ created: number }`

## Frontend

### `ImportBugsDialog` Component

Location: `apps/web/src/components/bugs/ImportBugsDialog.tsx`

Same UX as `ImportTestCasesDialog`:
1. **Upload state:** Drag-drop zone or file browse for `.xlsx`
2. **Preview state:** Table with columns: Row, Valid/Error icon, Title, Severity, Status, Steps count
3. **Summary bar:** X valid, Y errors
4. **Actions:** Back (to upload), Cancel, Import N Bugs

### Parsing Logic

- `parseExcelFile()` — reads first sheet, maps headers via `HEADER_MAP`
- `parseReproSteps()` — splits on `^\d+\.\s` pattern (same as test cases)
- `validateRows()` — checks required fields (title, severity), validates severity mapping

### Hook: `useImportBugs`

Location: `apps/web/src/hooks/useImportBugs.ts`

```typescript
export function useImportBugs(projectId: string) {
  // mutationFn → api.bulkImportBugs(projectId, data)
  // onSuccess → invalidate ['bugs', projectId], toast
}
```

### API Client

Add to `apps/web/src/lib/api.ts`:
```typescript
bulkImportBugs: (projectId, data) =>
  request(`/projects/${projectId}/bugs/bulk-import`, {
    method: 'POST', body: JSON.stringify(data),
  })
```

### Types

Add to `apps/web/src/lib/types.ts`:
- `BulkImportBugItem`
- `BulkImportBugsPayload`
- `BulkImportBugsResult`

### BugsPage Integration

Add "Import from Excel" button next to "Report Bug" on `BugsPage.tsx`, gated by `can('bugs', 'create')`.

## Data Flow

1. User drops `.xlsx` file → frontend parses with `xlsx` library
2. Rows mapped via HEADER_MAP, severity normalized, repro steps parsed
3. Preview table shown with valid/error row counts
4. User clicks "Import N Bugs" → `POST /projects/:projectId/bugs/bulk-import`
5. Backend creates all bugs in a single transaction, resolves status names to workflow status IDs
6. Query cache invalidated, success toast shown with import count
