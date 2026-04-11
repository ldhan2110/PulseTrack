# Import Bugs from Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Import from Excel" for bugs — schema change (preconditions field), bulk-import API endpoint, and frontend dialog following the existing ImportTestCasesDialog pattern.

**Architecture:** Frontend parses `.xlsx` with the `xlsx` library, shows a preview table, then sends validated items to a new `POST /projects/:projectId/bugs/bulk-import` endpoint. Backend creates all bugs in a single Prisma transaction, resolving workflow status names to IDs.

**Tech Stack:** NestJS, Prisma, React, TanStack Query, xlsx, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-11-import-bugs-excel-design.md`

---

## Task 1: Add `preconditions` field to Bug schema + DTOs

**Files:**
- Modify: `apps/api/prisma/schema.prisma:413` (Bug model)
- Modify: `apps/api/src/bugs/dto/create-bug.dto.ts`
- Modify: `apps/api/src/bugs/dto/update-bug.dto.ts`
- Modify: `apps/api/src/bugs/bugs.service.ts:49,159`
- Modify: `apps/web/src/lib/types.ts:312,338,351`

- [ ] **Step 1: Add `preconditions` to Prisma schema**

In `apps/api/prisma/schema.prisma`, inside the `Bug` model, add after `description`:

```prisma
  preconditions    String?
```

So lines 412-414 become:
```prisma
  title            String
  description      String?
  preconditions    String?
  severity         BugSeverity
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd apps/api && npx prisma migrate dev --name add-bug-preconditions
```

Expected: Migration created and applied successfully.

- [ ] **Step 3: Add `preconditions` to CreateBugDto**

In `apps/api/src/bugs/dto/create-bug.dto.ts`, add after the `description` field (line 25):

```typescript
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;
```

- [ ] **Step 4: Add `preconditions` to UpdateBugDto**

In `apps/api/src/bugs/dto/update-bug.dto.ts`, add after the `description` field (line 17):

```typescript
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;
```

- [ ] **Step 5: Wire `preconditions` into BugsService**

In `apps/api/src/bugs/bugs.service.ts`, in the `create` method, add `preconditions: dto.preconditions,` after `description: dto.description,` (around line 49).

In the `update` method, add after `if (dto.description !== undefined) data.description = dto.description;` (around line 159):
```typescript
      if (dto.preconditions !== undefined) data.preconditions = dto.preconditions;
```

- [ ] **Step 6: Update frontend types**

In `apps/web/src/lib/types.ts`:

Add `preconditions: string | null;` to the `Bug` interface (after line 316, the `description` field).

Add `preconditions?: string;` to the `CreateBugPayload` interface (after line 340, the `description` field).

Add `preconditions?: string;` to the `UpdateBugPayload` interface (after line 353, the `description` field).

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/ apps/api/src/bugs/dto/ apps/api/src/bugs/bugs.service.ts apps/web/src/lib/types.ts
git commit -m "feat: add preconditions field to Bug model"
```

---

## Task 2: Backend bulk-import endpoint

**Files:**
- Create: `apps/api/src/bugs/dto/bulk-import-bugs.dto.ts`
- Modify: `apps/api/src/bugs/bugs.service.ts`
- Modify: `apps/api/src/bugs/bugs.controller.ts`

- [ ] **Step 1: Create BulkImportBugsDto**

Create `apps/api/src/bugs/dto/bulk-import-bugs.dto.ts`:

```typescript
import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min,
  MinLength, MaxLength, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BugSeverity } from '@prisma/client';

class BulkImportReproStepDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @MaxLength(2000)
  content: string;
}

export class BulkImportBugItemDto {
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
  description?: string;

  @IsEnum(BugSeverity)
  severity: BugSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  actualResult?: string;

  @IsOptional()
  @IsString()
  statusName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportReproStepDto)
  reproSteps?: BulkImportReproStepDto[];
}

export class BulkImportBugsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkImportBugItemDto)
  items: BulkImportBugItemDto[];
}
```

- [ ] **Step 2: Add `bulkImport` method to BugsService**

In `apps/api/src/bugs/bugs.service.ts`, add this import at the top:

```typescript
import { BulkImportBugsDto } from './dto/bulk-import-bugs.dto';
```

Add the following method before the `delete` method (before line 234):

```typescript
  async bulkImport(projectId: string, reporterId: string, dto: BulkImportBugsDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch all BUG workflow statuses for this project
      const statuses = await tx.workflowStatus.findMany({
        where: { projectId, kind: 'BUG' },
        select: { id: true, name: true, isDefault: true },
      });

      const statusMap = new Map<string, string>();
      for (const s of statuses) {
        statusMap.set(s.name.toLowerCase(), s.id);
      }
      const defaultStatusId = statuses.find((s) => s.isDefault)?.id ?? null;

      // 2. Create bugs one-by-one (need sequential bugSeq increment)
      let created = 0;
      for (const item of dto.items) {
        const project = await tx.project.update({
          where: { id: projectId },
          data: { bugSeq: { increment: 1 } },
          select: { prefix: true, bugSeq: true },
        });
        const bugKey = project.prefix ? `${project.prefix}-BUG-${project.bugSeq}` : null;

        // Resolve status name to ID
        const resolvedStatusId = item.statusName
          ? statusMap.get(item.statusName.toLowerCase()) ?? defaultStatusId
          : defaultStatusId;

        const bug = await tx.bug.create({
          data: {
            projectId,
            reporterId,
            bugKey,
            title: item.title,
            description: item.description,
            preconditions: item.preconditions,
            severity: item.severity,
            environment: item.environment,
            expectedResult: item.expectedResult,
            actualResult: item.actualResult,
            workflowStatusId: resolvedStatusId,
          },
        });

        if (item.reproSteps?.length) {
          await tx.bugReproStep.createMany({
            data: item.reproSteps.map((s) => ({
              bugId: bug.id,
              position: s.position,
              content: s.content,
            })),
          });
        }

        created++;
      }

      return { created };
    });
  }
```

- [ ] **Step 3: Add bulk-import route to BugsController**

In `apps/api/src/bugs/bugs.controller.ts`, add the import:

```typescript
import { BulkImportBugsDto } from './dto/bulk-import-bugs.dto';
```

Add this route **before** the `@Get(':bugId')` route (before line 52) to avoid route conflicts:

```typescript
  @Post('bulk-import')
  @RequirePermission('bugs', 'create')
  bulkImport(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: BulkImportBugsDto,
  ) {
    return this.bugsService.bulkImport(projectId, req.user.id, dto);
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/bugs/dto/bulk-import-bugs.dto.ts apps/api/src/bugs/bugs.service.ts apps/api/src/bugs/bugs.controller.ts
git commit -m "feat: add POST /bugs/bulk-import endpoint"
```

---

## Task 3: Frontend types + API client + hook

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/hooks/useImportBugs.ts`

- [ ] **Step 1: Add bulk import types**

In `apps/web/src/lib/types.ts`, after the `BulkImportResult` interface (after line 834), add:

```typescript
export interface BulkImportBugItem {
  title: string;
  preconditions?: string;
  description?: string;
  severity: BugSeverity;
  environment?: string;
  expectedResult?: string;
  actualResult?: string;
  statusName?: string;
  reproSteps?: { position: number; content: string }[];
}

export interface BulkImportBugsPayload {
  items: BulkImportBugItem[];
}

export interface BulkImportBugsResult {
  created: number;
}
```

- [ ] **Step 2: Add API method**

In `apps/web/src/lib/api.ts`, after the `deleteBug` method (after line 212), add:

```typescript
  bulkImportBugs: (projectId: string, data: BulkImportBugsPayload) =>
    request<BulkImportBugsResult>(`/projects/${projectId}/bugs/bulk-import`, {
      method: 'POST', body: JSON.stringify(data),
    }),
```

Also add the import at the top where types are imported — add `BulkImportBugsPayload, BulkImportBugsResult` to the existing import from `'../lib/types'` (or `'@/lib/types'`).

- [ ] **Step 3: Create useImportBugs hook**

Create `apps/web/src/hooks/useImportBugs.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { BulkImportBugsPayload } from '../lib/types';

export function useImportBugs(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkImportBugsPayload) =>
      api.bulkImportBugs(projectId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success(`Imported ${result.created} bug${result.created !== 1 ? 's' : ''}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/hooks/useImportBugs.ts
git commit -m "feat: add bulk import bugs types, API client, and hook"
```

---

## Task 4: ImportBugsDialog component

**Files:**
- Create: `apps/web/src/components/bugs/ImportBugsDialog.tsx`

- [ ] **Step 1: Create ImportBugsDialog**

Create `apps/web/src/components/bugs/ImportBugsDialog.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { read, utils } from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import { useImportBugs } from '@/hooks/useImportBugs';
import type { BulkImportBugItem, BugSeverity } from '@/lib/types';

// ─── Column mapping ──────────────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  title: 'title',
  name: 'title',
  'bug title': 'title',
  'pre-conditions': 'preconditions',
  preconditions: 'preconditions',
  prerequisites: 'preconditions',
  'pre-condition': 'preconditions',
  environment: 'environment',
  env: 'environment',
  'steps to reproduce': 'reproSteps',
  'repro steps': 'reproSteps',
  steps: 'reproSteps',
  'actual result': 'actualResult',
  actual: 'actualResult',
  'expected result': 'expectedResult',
  expected: 'expectedResult',
  severity: 'severity',
  priority: 'severity',
  status: 'statusName',
};

const SEVERITY_MAP: Record<string, BugSeverity> = {
  critical: 'CRITICAL',
  major: 'HIGH',
  high: 'HIGH',
  medium: 'MEDIUM',
  moderate: 'MEDIUM',
  moderrate: 'MEDIUM',
  minor: 'LOW',
  low: 'LOW',
};

interface ParsedRow {
  title?: string;
  preconditions?: string;
  environment?: string;
  reproSteps?: string;
  actualResult?: string;
  expectedResult?: string;
  severity?: string;
  statusName?: string;
}

interface ValidatedRow {
  rowNum: number;
  valid: boolean;
  error?: string;
  item: BulkImportBugItem;
}

// ─── Parsing logic ───────────────────────────────────────────────────────────

function parseReproSteps(raw: string): { position: number; content: string }[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw.split(/(?=^\d+\.\s)/m).filter((s) => s.trim());
  return parts.map((part, i) => ({
    position: i,
    content: part.replace(/^\d+\.\s*/, '').trim(),
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
        item: { title: title ?? '', severity: 'MEDIUM' },
      };
    }

    const severity = row.severity
      ? SEVERITY_MAP[row.severity.toLowerCase().trim()]
      : undefined;

    if (row.severity && !severity) {
      return {
        rowNum: i + 1,
        valid: false,
        error: `Invalid severity: "${row.severity}"`,
        item: { title, severity: 'MEDIUM' },
      };
    }

    const reproSteps = row.reproSteps ? parseReproSteps(row.reproSteps) : undefined;

    return {
      rowNum: i + 1,
      valid: true,
      item: {
        title,
        preconditions: row.preconditions?.trim() || undefined,
        severity: severity ?? 'MEDIUM',
        environment: row.environment?.trim() || undefined,
        expectedResult: row.expectedResult?.trim() || undefined,
        actualResult: row.actualResult?.trim() || undefined,
        statusName: row.statusName?.trim() || undefined,
        reproSteps: reproSteps?.length ? reproSteps : undefined,
      },
    };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ImportBugsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ImportBugsDialog({
  open,
  onOpenChange,
  projectId,
}: ImportBugsDialogProps) {
  const [rows, setRows] = useState<ValidatedRow[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const importMutation = useImportBugs(projectId);

  const validRows = rows?.filter((r) => r.valid) ?? [];
  const errorRows = rows?.filter((r) => !r.valid) ?? [];

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
      <DialogContent className="w-fit max-w-0 max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Bugs from Excel</DialogTitle>
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
              <p>Title (required), Severity/Priority, Status, Pre-conditions, Environment, Steps to reproduce, Actual Result, Expected Result</p>
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
            </div>

            {/* Preview table */}
            <div className="rounded-lg border overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-12 h-9">Row</TableHead>
                    <TableHead className="w-10 h-9"></TableHead>
                    <TableHead className="h-9">Title</TableHead>
                    <TableHead className="w-20 h-9">Severity</TableHead>
                    <TableHead className="w-28 h-9">Status</TableHead>
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
                          <span className="truncate block max-w-70">{row.item.title}</span>
                        ) : (
                          <span className="text-destructive italic">{row.error}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {row.item.severity}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {row.item.statusName ?? 'Default'}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {row.item.reproSteps?.length ?? 0}
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
                  : `Import ${validRows.length} Bug${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bugs/ImportBugsDialog.tsx
git commit -m "feat: add ImportBugsDialog component"
```

---

## Task 5: Wire ImportBugsDialog into BugsPage

**Files:**
- Modify: `apps/web/src/pages/BugsPage.tsx`

- [ ] **Step 1: Add import state and button**

In `apps/web/src/pages/BugsPage.tsx`:

Add import at top:
```typescript
import { ImportBugsDialog } from '@/components/bugs/ImportBugsDialog';
```

Add state after `createOpen`:
```typescript
const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 2: Add "Import from Excel" button next to "Report Bug"**

In the empty-state block (around line 37), change the button area to:
```tsx
{canReport && (
  <div className="flex items-center gap-2">
    <Button variant="outline" onClick={() => setImportOpen(true)}>Import from Excel</Button>
    <Button onClick={() => setCreateOpen(true)}>Report Bug</Button>
  </div>
)}
```

In the main view header (around line 69), change the button area to:
```tsx
{canReport && (
  <div className="flex items-center gap-2">
    <Button variant="outline" onClick={() => setImportOpen(true)}>Import from Excel</Button>
    <Button onClick={() => setCreateOpen(true)}>Report Bug</Button>
  </div>
)}
```

In the empty-state center CTA (around line 50), keep it as just "Report Bug" (no import button there — it's the empty state CTA).

- [ ] **Step 3: Add ImportBugsDialog instances**

Add the ImportBugsDialog right after each CreateBugDialog instance. There are two — one in the empty-state return and one in the main return:

```tsx
<ImportBugsDialog
  open={importOpen}
  onOpenChange={setImportOpen}
  projectId={projectId}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/BugsPage.tsx
git commit -m "feat: wire Import from Excel button into BugsPage"
```
