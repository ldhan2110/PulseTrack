# Excel Test Case Import & Suite Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Excel (.xlsx) bulk import for test cases with preview validation, and add rename functionality for test suites in the sidebar.

**Architecture:** Client-side Excel parsing with SheetJS, preview dialog with validation, new backend bulk-import endpoint. Suite rename wires existing unused `useUpdateTestSuite` hook into ModuleTree UI matching the module rename pattern.

**Tech Stack:** SheetJS (xlsx), React, NestJS, Prisma, TanStack Query

---

### Task 1: Add Suite Rename to ModuleTree

**Files:**
- Modify: `apps/web/src/components/test-cases/ModuleTree.tsx:37-41` (imports), `:87-93` (hooks), `:274-306` (suite rendering)

- [ ] **Step 1: Add `useUpdateTestSuite` import and hook instance**

In `apps/web/src/components/test-cases/ModuleTree.tsx`, update the import from `useTestSuites` to include `useUpdateTestSuite`:

```typescript
import {
  useTestSuites,
  useCreateTestSuite,
  useUpdateTestSuite,
  useDeleteTestSuite,
} from '@/hooks/useTestSuites';
```

And add the hook instance after `deleteSuite`:

```typescript
const updateSuite = useUpdateTestSuite(projectId);
```

- [ ] **Step 2: Add suite rename handler**

Add after the existing `handleRename` function (around line 138):

```typescript
const handleRenameSuite = (suiteId: string) => {
  if (!editName.trim()) return;
  updateSuite.mutate({ suiteId, data: { name: editName.trim() } }, {
    onSuccess: () => setEditingId(null),
  });
};
```

Note: We reuse the existing `editingId` and `editName` state since module and suite edits are mutually exclusive (editing one clears the other via `setEditingId`).

- [ ] **Step 3: Update suite list rendering with double-click and inline edit**

Replace the suite item rendering block (the `{suites.map((suite: TestSuite) => (` block, lines 274-306) with:

```tsx
{suites.map((suite: TestSuite) => {
  const isSuiteEditing = editingId === suite.id;
  return (
    <div
      key={suite.id}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted/50 group',
        selectedSuiteId === suite.id && 'bg-muted',
      )}
      onClick={() => handleSelectSuite(suite.id)}
      onDoubleClick={() => {
        setEditingId(suite.id);
        setEditName(suite.name);
      }}
    >
      <ListChecks className="size-3.5 text-muted-foreground shrink-0" />
      {isSuiteEditing ? (
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => handleRenameSuite(suite.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSuite(suite.id);
            if (e.key === 'Escape') setEditingId(null);
          }}
          className="h-6 text-sm flex-1"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate flex-1">{suite.name}</span>
      )}
      <span className="text-xs text-muted-foreground">{suite._count?.members ?? 0}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => { setEditingId(suite.id); setEditName(suite.name); }}>
            <Pencil className="size-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => deleteSuite.mutate(suite.id)}
          >
            <Trash2 className="size-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
})}
```

- [ ] **Step 4: Test manually**

Run the dev server and verify:
1. Double-click a suite name → inline edit mode appears
2. Type new name + Enter → name updates, toast "Test suite updated"
3. Press Escape → cancels edit
4. Click the three-dot menu on a suite → "Rename" option appears above "Delete"
5. Click "Rename" → inline edit mode appears

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/test-cases/ModuleTree.tsx
git commit -m "feat: add rename support for test suites in ModuleTree sidebar"
```

---

### Task 2: Add Bulk Import Types

**Files:**
- Modify: `apps/web/src/lib/types.ts:770` (append after `CreateTestExecutionPayload`)

- [ ] **Step 1: Add bulk import types**

Add at the end of `apps/web/src/lib/types.ts` (after line 770):

```typescript

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export interface BulkImportTestCaseItem {
  title: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  tags?: string[];
  estimatedMinutes?: number;
  moduleName?: string;
  steps?: { position: number; action: string; expectedResult: string }[];
}

export interface BulkImportTestCasesPayload {
  items: BulkImportTestCaseItem[];
}

export interface BulkImportResult {
  created: number;
  modulesCreated: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add bulk import types for test case Excel import"
```

---

### Task 3: Add Bulk Import API Client Method

**Files:**
- Modify: `apps/web/src/lib/api.ts:1-54` (imports), `:435-438` (after `bulkAddToSuite`)

- [ ] **Step 1: Add type imports**

In `apps/web/src/lib/api.ts`, add `BulkImportTestCasesPayload` and `BulkImportResult` to the import block from `'./types'` (around line 1-54):

```typescript
import type {
  // ... existing imports ...
  TestExecutionAttachment,
  BulkImportTestCasesPayload,
  BulkImportResult,
} from './types';
```

- [ ] **Step 2: Add API method**

Add after the `bulkAddToSuite` method (after line 438), before the `// ─── Test Suites` comment:

```typescript
  bulkImportTestCases: (projectId: string, data: BulkImportTestCasesPayload) =>
    request<BulkImportResult>(`/projects/${projectId}/test-cases/bulk-import`, {
      method: 'POST', body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add bulkImportTestCases API client method"
```

---

### Task 4: Add useImportTestCases Hook

**Files:**
- Create: `apps/web/src/hooks/useImportTestCases.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/useImportTestCases.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { BulkImportTestCasesPayload } from '../lib/types';

export function useImportTestCases(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkImportTestCasesPayload) =>
      api.bulkImportTestCases(projectId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
      const msg = result.modulesCreated.length > 0
        ? `Imported ${result.created} test cases (${result.modulesCreated.length} new module${result.modulesCreated.length > 1 ? 's' : ''} created)`
        : `Imported ${result.created} test cases`;
      toast.success(msg);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useImportTestCases.ts
git commit -m "feat: add useImportTestCases mutation hook"
```

---

### Task 5: Add Backend Bulk Import DTO

**Files:**
- Create: `apps/api/src/test-cases/dto/bulk-import-test-cases.dto.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/test-cases/dto/bulk-import-test-cases.dto.ts`:

```typescript
import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min,
  MinLength, MaxLength, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

class BulkImportStepDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @MaxLength(2000)
  action: string;

  @IsString()
  @MaxLength(2000)
  expectedResult: string;
}

export class BulkImportTestCaseItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsString()
  moduleName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportStepDto)
  steps?: BulkImportStepDto[];
}

export class BulkImportTestCasesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkImportTestCaseItemDto)
  items: BulkImportTestCaseItemDto[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/test-cases/dto/bulk-import-test-cases.dto.ts
git commit -m "feat: add BulkImportTestCasesDto for bulk import validation"
```

---

### Task 6: Add Backend Bulk Import Service Method

**Files:**
- Modify: `apps/api/src/test-cases/test-cases.service.ts:171-199` (add after `bulkAddToSuite`)

- [ ] **Step 1: Add the import**

At the top of `apps/api/src/test-cases/test-cases.service.ts`, add the import:

```typescript
import { BulkImportTestCasesDto } from './dto/bulk-import-test-cases.dto';
```

- [ ] **Step 2: Add bulkImport method**

Add after the `bulkAddToSuite` method (after line 199) in `TestCasesService`:

```typescript
  async bulkImport(projectId: string, creatorId: string, dto: BulkImportTestCasesDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Collect unique module names
      const moduleNames = [...new Set(
        dto.items.map((item) => item.moduleName?.trim()).filter(Boolean) as string[],
      )];

      // 2. Resolve existing modules
      const existingModules = moduleNames.length > 0
        ? await tx.testModule.findMany({
            where: { projectId, name: { in: moduleNames, mode: 'insensitive' } },
            select: { id: true, name: true },
          })
        : [];

      const moduleMap = new Map<string, string>();
      for (const m of existingModules) {
        moduleMap.set(m.name.toLowerCase(), m.id);
      }

      // 3. Auto-create missing modules
      const modulesCreated: string[] = [];
      for (const name of moduleNames) {
        if (!moduleMap.has(name.toLowerCase())) {
          const created = await tx.testModule.create({
            data: { projectId, name, position: 0 },
          });
          moduleMap.set(name.toLowerCase(), created.id);
          modulesCreated.push(name);
        }
      }

      // 4. Create test cases
      let created = 0;
      for (const item of dto.items) {
        // Increment testCaseSeq
        const project = await tx.project.update({
          where: { id: projectId },
          data: { testCaseSeq: { increment: 1 } },
          select: { prefix: true, testCaseSeq: true },
        });
        const testCaseKey = project.prefix
          ? `${project.prefix}-TC-${project.testCaseSeq}`
          : null;

        const moduleId = item.moduleName
          ? moduleMap.get(item.moduleName.trim().toLowerCase())
          : undefined;

        const testCase = await tx.testCase.create({
          data: {
            projectId,
            creatorId,
            testCaseKey,
            title: item.title,
            preconditions: item.preconditions,
            expectedResult: item.expectedResult,
            priority: item.priority,
            tags: item.tags ?? [],
            estimatedMinutes: item.estimatedMinutes,
            moduleId: moduleId ?? null,
          },
        });

        if (item.steps?.length) {
          await tx.testCaseStep.createMany({
            data: item.steps.map((s) => ({
              testCaseId: testCase.id,
              position: s.position,
              action: s.action,
              expectedResult: s.expectedResult,
            })),
          });
        }

        created++;
      }

      return { created, modulesCreated };
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/test-cases/test-cases.service.ts
git commit -m "feat: add bulkImport service method for test case Excel import"
```

---

### Task 7: Add Backend Bulk Import Controller Endpoint

**Files:**
- Modify: `apps/api/src/test-cases/test-cases.controller.ts:1-9` (imports), `:62-68` (add before `bulkAddToSuite`)

- [ ] **Step 1: Add DTO import**

In `apps/api/src/test-cases/test-cases.controller.ts`, add the import:

```typescript
import { BulkImportTestCasesDto } from './dto/bulk-import-test-cases.dto';
```

- [ ] **Step 2: Add controller method**

Add the `bulkImport` method before the existing `bulkAddToSuite` method (before line 63). It must come before any `:testCaseId` param routes to avoid NestJS treating "bulk-import" as an ID:

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

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/test-cases/test-cases.controller.ts
git commit -m "feat: add POST bulk-import endpoint for test cases"
```

---

### Task 8: Install SheetJS and Create ImportTestCasesDialog

**Files:**
- Modify: `apps/web/package.json` (add xlsx dependency)
- Create: `apps/web/src/components/test-cases/ImportTestCasesDialog.tsx`

- [ ] **Step 1: Install xlsx**

```bash
cd apps/web && npm install xlsx
```

- [ ] **Step 2: Create the ImportTestCasesDialog component**

Create `apps/web/src/components/test-cases/ImportTestCasesDialog.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { read, utils } from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useImportTestCases } from '@/hooks/useImportTestCases';
import type { BulkImportTestCaseItem, Priority, TestModule } from '@/lib/types';

// ─── Column mapping ──────────────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  title: 'title',
  name: 'title',
  'test case name': 'title',
  module: 'moduleName',
  category: 'moduleName',
  area: 'moduleName',
  priority: 'priority',
  preconditions: 'preconditions',
  'pre-conditions': 'preconditions',
  prerequisites: 'preconditions',
  steps: 'steps',
  'test steps': 'steps',
  actions: 'steps',
  'expected result': 'expectedResult',
  expected: 'expectedResult',
  'expected output': 'expectedResult',
  tags: 'tags',
  'estimated minutes': 'estimatedMinutes',
  'est. minutes': 'estimatedMinutes',
  duration: 'estimatedMinutes',
};

const PRIORITY_MAP: Record<string, Priority> = {
  blocker: 'BLOCKER',
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

interface ParsedRow {
  title?: string;
  moduleName?: string;
  priority?: string;
  preconditions?: string;
  steps?: string;
  expectedResult?: string;
  tags?: string;
  estimatedMinutes?: string;
}

interface ValidatedRow {
  rowNum: number;
  valid: boolean;
  error?: string;
  item: BulkImportTestCaseItem;
}

// ─── Parsing logic ───────────────────────────────────────────────────────────

function parseSteps(raw: string): { position: number; action: string; expectedResult: string }[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw.split(/(?=^\d+\.\s)/m).filter((s) => s.trim());
  return parts.map((part, i) => ({
    position: i,
    action: part.replace(/^\d+\.\s*/, '').trim(),
    expectedResult: '',
  }));
}

function parseExcelFile(buffer: ArrayBuffer): ParsedRow[] {
  const workbook = read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonRows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return jsonRows.map((row) => {
    const mapped: ParsedRow = {};
    for (const [header, value] of Object.entries(row)) {
      const key = HEADER_MAP[header.toLowerCase().trim()];
      if (key) {
        mapped[key] = String(value ?? '').trim();
      }
    }
    return mapped;
  });
}

function validateRows(rows: ParsedRow[]): ValidatedRow[] {
  return rows.map((row, i) => {
    const title = row.title?.trim();
    if (!title || title.length < 3) {
      return {
        rowNum: i + 1,
        valid: false,
        error: !title ? 'Missing title' : 'Title too short (min 3 chars)',
        item: { title: title ?? '' },
      };
    }

    const priority = row.priority
      ? PRIORITY_MAP[row.priority.toLowerCase().trim()]
      : undefined;

    if (row.priority && !priority) {
      return {
        rowNum: i + 1,
        valid: false,
        error: `Invalid priority: "${row.priority}"`,
        item: { title },
      };
    }

    const steps = row.steps ? parseSteps(row.steps) : undefined;
    const tags = row.tags
      ? row.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;
    const estimatedMinutes = row.estimatedMinutes
      ? parseInt(row.estimatedMinutes, 10) || undefined
      : undefined;

    return {
      rowNum: i + 1,
      valid: true,
      item: {
        title,
        moduleName: row.moduleName?.trim() || undefined,
        priority,
        preconditions: row.preconditions?.trim() || undefined,
        expectedResult: row.expectedResult?.trim() || undefined,
        steps: steps?.length ? steps : undefined,
        tags: tags?.length ? tags : undefined,
        estimatedMinutes,
      },
    };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ImportTestCasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  modules: TestModule[];
}

export function ImportTestCasesDialog({
  open,
  onOpenChange,
  projectId,
  modules,
}: ImportTestCasesDialogProps) {
  const [rows, setRows] = useState<ValidatedRow[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const importMutation = useImportTestCases(projectId);

  const validRows = rows?.filter((r) => r.valid) ?? [];
  const errorRows = rows?.filter((r) => !r.valid) ?? [];

  // Detect new modules
  const existingModuleNames = new Set(modules.map((m) => m.name.toLowerCase()));
  const newModuleNames = [
    ...new Set(
      validRows
        .map((r) => r.item.moduleName)
        .filter((n): n is string => !!n && !existingModuleNames.has(n.toLowerCase())),
    ),
  ];

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelFile(buffer);
      if (parsed.length === 0) {
        setParseError('No data rows found in the Excel file');
        return;
      }
      setRows(validateRows(parsed));
    } catch {
      setParseError('Failed to parse Excel file. Please ensure it is a valid .xlsx file.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.xlsx')) {
        void handleFile(file);
      } else {
        setParseError('Please upload a .xlsx file');
      }
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = '';
    },
    [handleFile],
  );

  const handleImport = () => {
    if (validRows.length === 0) return;
    importMutation.mutate(
      { items: validRows.map((r) => r.item) },
      {
        onSuccess: () => {
          setRows(null);
          onOpenChange(false);
        },
      },
    );
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setRows(null);
      setParseError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[720px] max-w-[90vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Test Cases from Excel</DialogTitle>
        </DialogHeader>

        {!rows ? (
          /* ─── Upload state ─── */
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors',
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="size-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drag and drop your .xlsx file here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click below to browse
                </p>
              </div>
              <label>
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="size-3.5 mr-1.5" />
                    Choose File
                  </span>
                </Button>
              </label>
            </div>
            {parseError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {parseError}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Expected columns:</p>
              <p>Title (required), Module, Priority, Preconditions, Steps, Expected Result, Tags, Estimated Minutes</p>
            </div>
          </div>
        ) : (
          /* ─── Preview state ─── */
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Summary bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-3.5" />
                {validRows.length} valid
              </div>
              {errorRows.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5" />
                  {errorRows.length} error{errorRows.length > 1 ? 's' : ''}
                </div>
              )}
              {newModuleNames.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-md bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <Plus className="size-3.5" />
                  {newModuleNames.length} new module{newModuleNames.length > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Preview table */}
            <div className="rounded-lg border overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-12 h-9">Row</TableHead>
                    <TableHead className="w-10 h-9"></TableHead>
                    <TableHead className="h-9">Title</TableHead>
                    <TableHead className="w-24 h-9">Module</TableHead>
                    <TableHead className="w-20 h-9">Priority</TableHead>
                    <TableHead className="w-16 h-9">Steps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.rowNum}
                      className={cn(!row.valid && 'bg-destructive/5')}
                    >
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {row.rowNum}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {row.valid ? (
                          <CheckCircle2 className="size-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="size-3.5 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-sm">
                        {row.valid ? (
                          <span className="truncate block max-w-[280px]">{row.item.title}</span>
                        ) : (
                          <span className="text-destructive italic">{row.error}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {row.item.moduleName ?? '—'}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {row.item.priority ?? '—'}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {row.item.steps?.length ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {rows && (
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows(null)}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || importMutation.isPending}
              >
                {importMutation.isPending
                  ? 'Importing...'
                  : `Import ${validRows.length} Test Case${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/test-cases/ImportTestCasesDialog.tsx
git commit -m "feat: add ImportTestCasesDialog with Excel parsing and preview"
```

---

### Task 9: Wire Import Button into TestCasesPage

**Files:**
- Modify: `apps/web/src/pages/TestCasesPage.tsx:1-21` (imports), `:35-37` (state), `:72-73` (empty state button), `:119-122` (header buttons), `:190-205` (dialog rendering)

- [ ] **Step 1: Add imports**

Add to the imports in `apps/web/src/pages/TestCasesPage.tsx`:

```typescript
import { ClipboardList, Search, FileSpreadsheet } from 'lucide-react';
import { ImportTestCasesDialog } from '@/components/test-cases/ImportTestCasesDialog';
```

Note: `FileSpreadsheet` is added to the existing lucide-react import. `ClipboardList` and `Search` are already imported.

- [ ] **Step 2: Add state**

Add after the existing `suiteManagerOpen` state (line 37):

```typescript
const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 3: Add Import button to header (both empty state and main view)**

In the **empty state** header (around line 72-73), replace the single Button with two buttons:

```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" onClick={() => setImportOpen(true)}>
    <FileSpreadsheet className="size-3.5 mr-1.5" />
    Import Excel
  </Button>
  <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
</div>
```

In the **main view** header (around line 120-121), replace the single Button with two buttons:

```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" onClick={() => setImportOpen(true)}>
    <FileSpreadsheet className="size-3.5 mr-1.5" />
    Import Excel
  </Button>
  <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
</div>
```

- [ ] **Step 4: Add ImportTestCasesDialog rendering**

Add after the `SuiteManager` closing tag in both the empty state and main view (before the closing `</div>` of the return):

```tsx
<ImportTestCasesDialog
  open={importOpen}
  onOpenChange={setImportOpen}
  projectId={projectId}
  modules={modules}
/>
```

- [ ] **Step 5: Test manually**

1. Navigate to Test Cases page
2. Click "Import Excel" button → dialog opens with drop zone
3. Drop a .xlsx file → preview table appears with validation
4. Click "Import N Test Cases" → test cases created, toast shown, table refreshes
5. Verify new modules auto-created appear in sidebar

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/TestCasesPage.tsx
git commit -m "feat: wire Import Excel button and dialog into TestCasesPage"
```

---

## File Structure Summary

### New Files
| File | Purpose |
|---|---|
| `apps/web/src/components/test-cases/ImportTestCasesDialog.tsx` | Excel upload dialog with parsing, validation, preview |
| `apps/web/src/hooks/useImportTestCases.ts` | TanStack Query mutation hook for bulk import |
| `apps/api/src/test-cases/dto/bulk-import-test-cases.dto.ts` | NestJS DTO with class-validator decorators |

### Modified Files
| File | Change |
|---|---|
| `apps/web/src/lib/types.ts` | Add `BulkImportTestCaseItem`, `BulkImportTestCasesPayload`, `BulkImportResult` |
| `apps/web/src/lib/api.ts` | Add `bulkImportTestCases` method |
| `apps/web/src/pages/TestCasesPage.tsx` | Add Import button + dialog |
| `apps/web/src/components/test-cases/ModuleTree.tsx` | Add suite rename (double-click + dropdown) |
| `apps/api/src/test-cases/test-cases.controller.ts` | Add `POST bulk-import` endpoint |
| `apps/api/src/test-cases/test-cases.service.ts` | Add `bulkImport` method |
| `apps/web/package.json` | Add `xlsx` dependency |

### Task Dependency Order
```
Task 1 (Suite Rename) — independent, can run first
Task 2 (Types) → Task 3 (API client) → Task 4 (Hook) → Task 8 (Dialog) → Task 9 (Wire up)
Task 5 (Backend DTO) → Task 6 (Service) → Task 7 (Controller)
Tasks 5-7 (backend) and Tasks 2-4 (frontend types/hook) can run in parallel
```
