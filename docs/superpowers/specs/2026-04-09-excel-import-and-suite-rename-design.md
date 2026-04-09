# Excel Test Case Import & Suite Rename

**Date:** 2026-04-09
**Status:** Approved

## Overview

Two features for the Test Cases page:

1. **Excel Import** — Upload `.xlsx` files to bulk-create test cases with preview validation
2. **Suite Rename** — Add rename support for test suites (matching existing module rename UX)

---

## Feature 1: Excel Test Case Import

### Architecture

**Client-side parsing approach.** The `.xlsx` file is parsed in the browser using the `xlsx` (SheetJS) package. Parsed rows are validated and previewed client-side. On confirmation, valid rows are sent to a new backend bulk-import endpoint.

No file upload infrastructure (multer, temp storage) is needed.

### New Dependency

- `xlsx` (SheetJS) added to `apps/web/package.json` — used for `.xlsx` parsing only

### Column Mapping

Headers are matched case-insensitively with flexible aliases:

| Excel Header Aliases | Target Field | Required | Notes |
|---|---|---|---|
| ID, Test Case ID, Key | *ignored* | No | System auto-generates `testCaseKey` via `PREFIX-TC-N` |
| Title, Name, Test Case Name | `title` | **Yes** | Rows without title are marked invalid |
| Module, Category, Area | `moduleId` | No | Resolved by name; auto-created if not found |
| Priority | `priority` | No | Maps: High→HIGH, Critical→CRITICAL, Medium→MEDIUM, Low→LOW, Blocker→BLOCKER |
| Preconditions, Pre-conditions, Prerequisites | `preconditions` | No | |
| Steps, Test Steps, Actions | `steps[]` | No | Parsed by numbered pattern (`1.`, `2.`, etc.) |
| Expected Result, Expected, Expected Output | `expectedResult` | No | |
| Tags | `tags[]` | No | Comma-separated |
| Estimated Minutes, Est. Minutes, Duration | `estimatedMinutes` | No | Parsed as integer |

Unmatched columns are silently ignored.

### Steps Parsing

The Steps column is parsed using numbered pattern detection:

```
"1. Navigate to Company module\n2. Observe the list view"
```

→ Splits on patterns matching `/^\d+\.\s/m` to produce:

```json
[
  { "position": 0, "action": "Navigate to Company module", "expectedResult": "" },
  { "position": 1, "action": "Observe the list view", "expectedResult": "" }
]
```

Lines that don't start with a number are appended to the previous step's action (handles line-wrapping).

### UI Flow

#### Entry Point

"Import Excel" button added next to "+ New Test Case" in the `TestCasesPage` header. Opens an `ImportTestCasesDialog` component.

#### Dialog States

1. **Upload state** — File drop zone with drag-and-drop support + file picker button. Accepts `.xlsx` only.

2. **Preview state** — After parsing:
   - **Summary bar**: valid count (green), error count (red), new modules to create (blue)
   - **Preview table**: row number, status (✓/✗), title, module, priority, step count
   - **Error rows**: highlighted red with inline error message (e.g., "Missing title")
   - **Footer**: "Import N Test Cases" button (count = valid rows only), Cancel button
   - Invalid rows are excluded from import automatically

3. **Importing state** — Progress indicator while the API call executes

4. **Done state** — Toast success message, dialog closes, test-cases query invalidated to refresh table

#### New Component

`apps/web/src/components/test-cases/ImportTestCasesDialog.tsx`

Contains:
- File drop zone with `useCallback` + drag events
- `parseExcelFile(file: File)` — uses SheetJS to read workbook, extract first sheet, map headers
- `validateRows(rows)` — checks required fields, normalizes priority values
- `resolveModules(rows, existingModules)` — identifies which modules exist vs. need creation
- Preview table rendering
- Import submission

#### New Hook

`apps/web/src/hooks/useImportTestCases.ts`

```typescript
export function useImportTestCases(projectId: string) {
  // useMutation wrapping api.bulkImportTestCases
  // onSuccess: invalidate ['test-cases', projectId] and ['test-modules', projectId]
}
```

#### API Client Addition

In `apps/web/src/lib/api.ts`:

```typescript
bulkImportTestCases: (projectId: string, data: BulkImportTestCasesPayload) =>
  request<BulkImportResult>(`/projects/${projectId}/test-cases/bulk-import`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
```

### Backend

#### New Endpoint

`POST /projects/:projectId/test-cases/bulk-import`

#### New DTO

`apps/api/src/test-cases/dto/bulk-import-test-cases.dto.ts`

```typescript
class BulkImportTestCaseItemDto {
  title: string;           // required, 3-200 chars
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  tags?: string[];
  estimatedMinutes?: number;
  moduleName?: string;     // resolved to moduleId server-side
  steps?: TestCaseStepDto[];
}

class BulkImportTestCasesDto {
  items: BulkImportTestCaseItemDto[];  // max 500 items
}
```

#### Service Method

`TestCasesService.bulkImport(projectId, creatorId, dto)`:

1. Extract unique `moduleName` values from items
2. Query existing modules by name for this project
3. Auto-create missing modules (in transaction)
4. For each item:
   - Increment `testCaseSeq` on project to generate `testCaseKey`
   - Create `TestCase` with resolved `moduleId`
   - Create `TestCaseStep` records if steps provided
5. All in a single Prisma `$transaction`
6. Return `{ created: number, modules_created: string[] }`

#### Controller Method

Added to `TestCasesController`:

```typescript
@Post('bulk-import')
bulkImport(
  @Param('projectId') projectId: string,
  @Req() req: any,
  @Body() dto: BulkImportTestCasesDto,
) {
  return this.service.bulkImport(projectId, req.user.id, dto);
}
```

### Types

Added to `apps/web/src/lib/types.ts`:

```typescript
interface BulkImportTestCaseItem {
  title: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  tags?: string[];
  estimatedMinutes?: number;
  moduleName?: string;
  steps?: { position: number; action: string; expectedResult: string }[];
}

interface BulkImportTestCasesPayload {
  items: BulkImportTestCaseItem[];
}

interface BulkImportResult {
  created: number;
  modules_created: string[];
}
```

---

## Feature 2: Suite Rename

### Scope

Add rename functionality to test suites in `ModuleTree.tsx`, matching the existing module rename pattern exactly.

### Existing Infrastructure (no changes needed)

- `useUpdateTestSuite` hook in `apps/web/src/hooks/useTestSuites.ts` — already exists, currently unused
- `api.updateTestSuite` in `apps/web/src/lib/api.ts` — `PATCH /projects/:projectId/test-suites/:suiteId`
- `UpdateTestSuitePayload` type — `{ name?: string; description?: string }`
- Backend `TestSuitesController.update` + `TestSuitesService.update` — already implemented

### Changes Required

**`apps/web/src/components/test-cases/ModuleTree.tsx`** (single file change):

1. **Import** `useUpdateTestSuite` from `@/hooks/useTestSuites` (add to existing import)
2. **Hook instance**: `const updateSuite = useUpdateTestSuite(projectId);`
3. **State**: Add `editingSuiteId` and `editSuiteName` state (or reuse `editingId`/`editName` since module and suite edits are mutually exclusive)
4. **Double-click handler** on suite row: sets `editingSuiteId` and `editSuiteName`
5. **Inline Input**: When `editingSuiteId === suite.id`, show `Input` instead of `<span>` for suite name (same pattern as module nodes)
6. **handleRenameSuite**: Calls `updateSuite.mutate({ suiteId, data: { name: editSuiteName.trim() } })`
7. **Dropdown menu**: Add "Rename" `DropdownMenuItem` with `Pencil` icon before the existing "Delete" item

### UX Behavior (matching modules)

- Double-click suite name → inline edit mode
- Click "Rename" in dropdown → inline edit mode
- Enter → save
- Escape → cancel
- Blur → save
- Empty name → no-op (don't save)

---

## Files Changed Summary

### New Files
- `apps/web/src/components/test-cases/ImportTestCasesDialog.tsx`
- `apps/web/src/hooks/useImportTestCases.ts`
- `apps/api/src/test-cases/dto/bulk-import-test-cases.dto.ts`

### Modified Files
- `apps/web/package.json` — add `xlsx` dependency
- `apps/web/src/pages/TestCasesPage.tsx` — add Import button + dialog
- `apps/web/src/lib/api.ts` — add `bulkImportTestCases` method
- `apps/web/src/lib/types.ts` — add bulk import types
- `apps/api/src/test-cases/test-cases.controller.ts` — add `bulkImport` endpoint
- `apps/api/src/test-cases/test-cases.service.ts` — add `bulkImport` method
- `apps/web/src/components/test-cases/ModuleTree.tsx` — add suite rename UI
