# WBS Import Excel & AI Suggestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Import Excel and AI WBS Suggestion Wizard features to the WBS module, both sharing a bulk-create API endpoint.

**Architecture:** Client-side Excel parsing with `xlsx-js-style` feeds a shared `POST /wbs/bulk-create` endpoint. AI Wizard uses a 4-step form wizard → CLI-based AI generation (reusing existing job queue + Socket.IO pattern) → split-panel preview with chat iteration. Both converge on the same bulk-create payload.

**Tech Stack:** NestJS (API), React + TanStack Query (Web), Prisma ORM, BullMQ job queue, Socket.IO, xlsx-js-style, class-validator

---

## Task 1: Bulk-Create API — DTO & Validation

**Files:**
- Create: `apps/api/src/wbs/dto/bulk-create-wbs.dto.ts`

- [ ] **Step 1: Create the BulkCreateWbsDto with nested validation**

```typescript
// apps/api/src/wbs/dto/bulk-create-wbs.dto.ts
import {
  IsString, IsOptional, IsDateString, IsNumber, IsArray,
  ValidateNested, MinLength, MaxLength, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCreateSubtaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;
}

export class BulkCreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateSubtaskDto)
  subtasks?: BulkCreateSubtaskDto[];
}

export class BulkCreatePhaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateTaskDto)
  tasks?: BulkCreateTaskDto[];
}

export class BulkCreateWbsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreatePhaseDto)
  phases: BulkCreatePhaseDto[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/wbs/dto/bulk-create-wbs.dto.ts
git commit -m "feat(api): add BulkCreateWbsDto for WBS bulk import"
```

---

## Task 2: Bulk-Create API — Service Method

**Files:**
- Modify: `apps/api/src/wbs/wbs.service.ts:1-288`

- [ ] **Step 1: Add bulkCreate method to WbsService**

Add this method after the `reorderSubtasks` method (after line 212) and before the `// ─── Rollup` comment:

```typescript
  // ─── Bulk Create ──────────────────────────────────────────

  async bulkCreate(projectId: string, dto: BulkCreateWbsDto) {
    // Get current max phase position
    const maxPhasePos = await this.prisma.wbsPhase.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    let phasePosition = (maxPhasePos._max.position ?? -1) + 1;

    const createdPhaseIds: string[] = [];

    for (const phaseDto of dto.phases) {
      const phase = await this.prisma.wbsPhase.create({
        data: {
          projectId,
          title: phaseDto.title,
          description: phaseDto.description,
          position: phasePosition++,
          planStart: phaseDto.planStart ? new Date(phaseDto.planStart) : undefined,
          planEnd: phaseDto.planEnd ? new Date(phaseDto.planEnd) : undefined,
          actualStart: phaseDto.actualStart ? new Date(phaseDto.actualStart) : undefined,
          actualEnd: phaseDto.actualEnd ? new Date(phaseDto.actualEnd) : undefined,
          progress: phaseDto.progress ?? 0,
        },
      });
      createdPhaseIds.push(phase.id);

      if (phaseDto.tasks) {
        let taskPosition = 0;
        for (const taskDto of phaseDto.tasks) {
          const task = await this.prisma.wbsTask.create({
            data: {
              phaseId: phase.id,
              title: taskDto.title,
              description: taskDto.description,
              position: taskPosition++,
              planStart: taskDto.planStart ? new Date(taskDto.planStart) : undefined,
              planEnd: taskDto.planEnd ? new Date(taskDto.planEnd) : undefined,
              actualStart: taskDto.actualStart ? new Date(taskDto.actualStart) : undefined,
              actualEnd: taskDto.actualEnd ? new Date(taskDto.actualEnd) : undefined,
              progress: taskDto.progress ?? 0,
            },
          });

          if (taskDto.subtasks) {
            let subtaskPosition = 0;
            for (const subtaskDto of taskDto.subtasks) {
              await this.prisma.wbsSubtask.create({
                data: {
                  taskId: task.id,
                  title: subtaskDto.title,
                  description: subtaskDto.description,
                  position: subtaskPosition++,
                  planStart: subtaskDto.planStart ? new Date(subtaskDto.planStart) : undefined,
                  planEnd: subtaskDto.planEnd ? new Date(subtaskDto.planEnd) : undefined,
                  actualStart: subtaskDto.actualStart ? new Date(subtaskDto.actualStart) : undefined,
                  actualEnd: subtaskDto.actualEnd ? new Date(subtaskDto.actualEnd) : undefined,
                  progress: subtaskDto.progress ?? 0,
                },
              });
            }
            await this.rollupTask(task.id);
          }
        }
      }

      await this.rollupPhase(phase.id);
    }

    // Return all created phases with nested includes
    return this.prisma.wbsPhase.findMany({
      where: { id: { in: createdPhaseIds } },
      orderBy: { position: 'asc' },
      include: PHASE_INCLUDE,
    });
  }
```

Also add the import at the top of the file:

```typescript
import { BulkCreateWbsDto } from './dto/bulk-create-wbs.dto';
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/wbs/wbs.service.ts
git commit -m "feat(api): add bulkCreate method to WbsService"
```

---

## Task 3: Bulk-Create API — Controller Endpoint

**Files:**
- Modify: `apps/api/src/wbs/wbs.controller.ts:1-119`

- [ ] **Step 1: Add bulk-create endpoint to WbsController**

Add the import for `BulkCreateWbsDto` at the top alongside existing DTO imports:

```typescript
import { BulkCreateWbsDto } from './dto/bulk-create-wbs.dto';
```

Add this endpoint after the `reorderPhases` method (after line 55) and before the `// ─── Tasks` comment:

```typescript
  @Post('projects/:projectId/wbs/bulk-create')
  bulkCreate(
    @Param('projectId') projectId: string,
    @Body() dto: BulkCreateWbsDto,
  ) {
    return this.wbsService.bulkCreate(projectId, dto);
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/wbs/wbs.controller.ts
git commit -m "feat(api): add POST /wbs/bulk-create endpoint"
```

---

## Task 4: Frontend Types & API Client for Bulk-Create

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useWbs.ts`

- [ ] **Step 1: Add BulkCreateWbs types to types.ts**

Add these interfaces after the existing `UpdateWbsSubtaskPayload` interface (around line 1215):

```typescript
// ─── WBS Bulk Create Types ────────────────────────────────

export interface BulkCreateWbsSubtaskPayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
}

export interface BulkCreateWbsTaskPayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
  subtasks?: BulkCreateWbsSubtaskPayload[];
}

export interface BulkCreateWbsPhasePayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
  tasks?: BulkCreateWbsTaskPayload[];
}

export interface BulkCreateWbsPayload {
  phases: BulkCreateWbsPhasePayload[];
}
```

- [ ] **Step 2: Add bulkCreateWbs to api.ts**

Add the import of `BulkCreateWbsPayload` in the import block at the top of `api.ts`, and add this method in the WBS section (after `reorderWbsPhases`):

```typescript
  bulkCreateWbs: (projectId: string, data: BulkCreateWbsPayload) =>
    request<WbsPhase[]>(`/projects/${projectId}/wbs/bulk-create`, {
      method: 'POST', body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Add useBulkCreateWbs hook to useWbs.ts**

Add the import of `BulkCreateWbsPayload` at the top, and add this hook after `useReorderWbsPhases`:

```typescript
export function useBulkCreateWbs(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkCreateWbsPayload) => api.bulkCreateWbs(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('WBS items imported');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/hooks/useWbs.ts
git commit -m "feat(web): add bulk-create WBS types, API client, and hook"
```

---

## Task 5: Import Excel — Parser

**Files:**
- Create: `apps/web/src/lib/importWbs.ts`

- [ ] **Step 1: Create the Excel parsing module**

```typescript
// apps/web/src/lib/importWbs.ts
import XLSX from 'xlsx-js-style';
import type { BulkCreateWbsPhasePayload, BulkCreateWbsTaskPayload, BulkCreateWbsSubtaskPayload } from './types';

export interface ImportPreviewRow {
  level: 0 | 1 | 2;
  title: string;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  error?: string;
}

export interface ImportParseResult {
  previewRows: ImportPreviewRow[];
  payload: { phases: BulkCreateWbsPhasePayload[] };
  errors: number;
}

/**
 * Parse a DD/MM/YYYY date string into ISO date string (YYYY-MM-DD).
 * Returns null if the input is empty or the dash placeholder "—".
 */
function parseDateCell(value: string | undefined | null): string | null {
  if (!value || value.trim() === '' || value.trim() === '\u2014' || value.trim() === '—') return null;
  const trimmed = value.trim();
  // Try DD/MM/YYYY format (matching export)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Try ISO format directly
  const iso = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return trimmed.slice(0, 10);
  return null;
}

/**
 * Parse progress string like "75%" into a number 0-100.
 */
function parseProgress(value: string | undefined | null): number {
  if (!value) return 0;
  const num = parseFloat(String(value).replace('%', '').trim());
  return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
}

/**
 * Detect indent level from the Task column value.
 * Export uses: 0 spaces = Phase, 2 spaces = Task, 4 spaces = Subtask
 */
function detectLevel(title: string): { level: 0 | 1 | 2; cleanTitle: string } {
  const match = title.match(/^(\s*)/);
  const spaces = match ? match[1].length : 0;
  const cleanTitle = title.trim();
  if (spaces >= 4) return { level: 2, cleanTitle };
  if (spaces >= 2) return { level: 1, cleanTitle };
  return { level: 0, cleanTitle };
}

const HEADER_ROWS = 2; // Row 0 = month headers, Row 1 = day numbers
const COL_TASK = 0;
const COL_PLAN_START = 1;
const COL_PLAN_END = 2;
const COL_ACTUAL_START = 3;
const COL_ACTUAL_END = 4;
const COL_PROGRESS = 5;

function getCellString(ws: XLSX.WorkSheet, row: number, col: number): string {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[ref];
  if (!cell) return '';
  return String(cell.v ?? '');
}

export function parseWbsExcel(file: ArrayBuffer): ImportParseResult {
  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  if (!ws || !ws['!ref']) {
    return { previewRows: [], payload: { phases: [] }, errors: 0 };
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const previewRows: ImportPreviewRow[] = [];

  // Parse data rows (skip header rows)
  for (let r = HEADER_ROWS; r <= range.e.r; r++) {
    const rawTitle = getCellString(ws, r, COL_TASK);
    if (!rawTitle.trim()) continue; // Skip empty rows

    const { level, cleanTitle } = detectLevel(rawTitle);
    const planStart = parseDateCell(getCellString(ws, r, COL_PLAN_START));
    const planEnd = parseDateCell(getCellString(ws, r, COL_PLAN_END));
    const actualStart = parseDateCell(getCellString(ws, r, COL_ACTUAL_START));
    const actualEnd = parseDateCell(getCellString(ws, r, COL_ACTUAL_END));
    const progress = parseProgress(getCellString(ws, r, COL_PROGRESS));

    let error: string | undefined;
    if (!cleanTitle) error = 'Missing title';

    previewRows.push({
      level,
      title: cleanTitle,
      planStart,
      planEnd,
      actualStart,
      actualEnd,
      progress,
      error,
    });
  }

  // Build nested payload
  const phases: BulkCreateWbsPhasePayload[] = [];
  let currentPhase: BulkCreateWbsPhasePayload | null = null;
  let currentTask: BulkCreateWbsTaskPayload | null = null;

  for (const row of previewRows) {
    if (row.error) continue; // Skip rows with errors

    const dateFields = {
      ...(row.planStart ? { planStart: row.planStart } : {}),
      ...(row.planEnd ? { planEnd: row.planEnd } : {}),
      ...(row.actualStart ? { actualStart: row.actualStart } : {}),
      ...(row.actualEnd ? { actualEnd: row.actualEnd } : {}),
      progress: row.progress,
    };

    if (row.level === 0) {
      currentPhase = { title: row.title, ...dateFields, tasks: [] };
      phases.push(currentPhase);
      currentTask = null;
    } else if (row.level === 1) {
      if (!currentPhase) {
        // Orphan task — create an implicit phase
        currentPhase = { title: 'Imported Tasks', tasks: [] };
        phases.push(currentPhase);
      }
      currentTask = { title: row.title, ...dateFields, subtasks: [] };
      currentPhase.tasks!.push(currentTask);
    } else if (row.level === 2) {
      if (!currentTask) {
        // Orphan subtask — create implicit task under current/new phase
        if (!currentPhase) {
          currentPhase = { title: 'Imported Tasks', tasks: [] };
          phases.push(currentPhase);
        }
        currentTask = { title: 'Imported Subtasks', subtasks: [] };
        currentPhase.tasks!.push(currentTask);
      }
      const subtask: BulkCreateWbsSubtaskPayload = { title: row.title, ...dateFields };
      currentTask.subtasks!.push(subtask);
    }
  }

  const errors = previewRows.filter((r) => r.error).length;

  return { previewRows, payload: { phases }, errors };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/importWbs.ts
git commit -m "feat(web): add WBS Excel import parser"
```

---

## Task 6: Import Excel — Dialog Component

**Files:**
- Create: `apps/web/src/components/wbs/WbsImportDialog.tsx`

- [ ] **Step 1: Create the import dialog with preview table**

```typescript
// apps/web/src/components/wbs/WbsImportDialog.tsx
import { useState, useCallback } from 'react';
import { Upload, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { parseWbsExcel, type ImportParseResult, type ImportPreviewRow } from '@/lib/importWbs';
import { useBulkCreateWbs } from '@/hooks/useWbs';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const LEVEL_LABELS: Record<0 | 1 | 2, string> = {
  0: 'Phase',
  1: 'Task',
  2: 'Subtask',
};

const LEVEL_COLORS: Record<0 | 1 | 2, string> = {
  0: 'bg-purple-100 text-purple-700',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-indigo-100 text-indigo-700',
};

export function WbsImportDialog({ open, onClose, projectId }: Props) {
  const [result, setResult] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const bulkCreate = useBulkCreateWbs(projectId);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (data instanceof ArrayBuffer) {
        setResult(parseWbsExcel(data));
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.xlsx')) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = () => {
    if (!result) return;
    bulkCreate.mutate(result.payload, {
      onSuccess: () => {
        setResult(null);
        setFileName('');
        onClose();
      },
    });
  };

  const handleClose = () => {
    setResult(null);
    setFileName('');
    onClose();
  };

  const totalItems = result
    ? result.previewRows.filter((r) => !r.error).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-green-600" />
            Import WBS from Excel
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('wbs-import-input')?.click()}
          >
            <Upload className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Drop .xlsx file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts the same format as WBS Export
              </p>
            </div>
            <input
              id="wbs-import-input"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="size-4 text-green-600" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{totalItems} items</Badge>
                {result.errors > 0 && (
                  <Badge variant="destructive">{result.errors} errors</Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => { setResult(null); setFileName(''); }}
              >
                <X className="size-3 mr-1" /> Clear
              </Button>
            </div>

            <div className="flex-1 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Level</th>
                    <th className="px-3 py-2 text-left font-medium">Title</th>
                    <th className="px-3 py-2 text-left font-medium">Plan Start</th>
                    <th className="px-3 py-2 text-left font-medium">Plan End</th>
                    <th className="px-3 py-2 text-left font-medium">Progress</th>
                    <th className="px-3 py-2 text-left font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className={row.error ? 'bg-red-50' : i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                    >
                      <td className="px-3 py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${LEVEL_COLORS[row.level]}`}>
                          {LEVEL_LABELS[row.level]}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-medium" style={{ paddingLeft: `${12 + row.level * 16}px` }}>
                        {row.title || <span className="text-muted-foreground italic">Empty</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.planStart ?? '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.planEnd ?? '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.progress}%</td>
                      <td className="px-3 py-1.5">
                        {row.error && (
                          <span title={row.error}>
                            <AlertCircle className="size-3.5 text-destructive" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={!result || totalItems === 0 || bulkCreate.isPending}
          >
            {bulkCreate.isPending ? 'Importing...' : `Import ${totalItems} items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/wbs/WbsImportDialog.tsx
git commit -m "feat(web): add WbsImportDialog component"
```

---

## Task 7: Wire Import Excel into WbsToolbar & WbsPage

**Files:**
- Modify: `apps/web/src/components/wbs/WbsToolbar.tsx:1-33`
- Modify: `apps/web/src/pages/WbsPage.tsx:1-113`

- [ ] **Step 1: Add Import button to WbsToolbar**

Replace the entire content of `WbsToolbar.tsx`:

```typescript
import { Plus, Download, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportWbsToExcel } from '@/lib/exportWbs';
import type { WbsPhase } from '@/lib/types';

interface WbsToolbarProps {
  onAddPhase: () => void;
  onImportExcel: () => void;
  onAiSuggest: () => void;
  phases: WbsPhase[];
}

export function WbsToolbar({ onAddPhase, onImportExcel, onAiSuggest, phases }: WbsToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Work Breakdown Structure</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={onAiSuggest}
        >
          <Sparkles className="size-3" /> AI Suggest
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={onImportExcel}
        >
          <Upload className="size-3" /> Import Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => exportWbsToExcel(phases)}
          disabled={phases.length === 0}
        >
          <Download className="size-3" /> Export Excel
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddPhase}>
          <Plus className="size-3" /> Add Phase
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire import dialog and AI wizard state into WbsPage**

In `WbsPage.tsx`, add state and imports. After `const [dialogMode, setDialogMode] = useState<DialogMode>(null);` (line 20), add:

```typescript
const [showImportDialog, setShowImportDialog] = useState(false);
const [showAiWizard, setShowAiWizard] = useState(false);
```

Add imports at the top:

```typescript
import { WbsImportDialog } from '@/components/wbs/WbsImportDialog';
```

Update the `<WbsToolbar>` component to pass the new props:

```tsx
<WbsToolbar
  onAddPhase={() => setDialogMode({ type: 'phase' })}
  onImportExcel={() => setShowImportDialog(true)}
  onAiSuggest={() => setShowAiWizard(false)} // Placeholder — will be wired in AI wizard task
  phases={phases}
/>
```

Add the import dialog before the closing `</div>` of the return (after the `WbsTaskDialog`):

```tsx
<WbsImportDialog
  open={showImportDialog}
  onClose={() => setShowImportDialog(false)}
  projectId={projectId}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wbs/WbsToolbar.tsx apps/web/src/pages/WbsPage.tsx
git commit -m "feat(web): wire Import Excel button and dialog into WBS page"
```

---

## Task 8: AI WBS Generation — Backend DTOs & Types

**Files:**
- Create: `apps/api/src/ai-wbs-generation/dto/generate-wbs.dto.ts`

- [ ] **Step 1: Create DTOs and types**

```typescript
// apps/api/src/ai-wbs-generation/dto/generate-wbs.dto.ts
import { IsString, IsOptional, IsArray, IsNumber, IsDateString, MinLength, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class TeamRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  role: string;

  @IsNumber()
  @Min(1)
  count: number;
}

export class GenerateWbsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  instructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => typeof value === 'string' ? parseInt(value, 10) : value)
  teamSize?: number;

  @IsOptional()
  @IsArray()
  teamRoles?: TeamRoleDto[];

  @IsOptional()
  @IsDateString()
  projectStartDate?: string;

  @IsOptional()
  @IsDateString()
  targetEndDate?: string;

  @IsOptional()
  @IsString()
  methodology?: 'agile' | 'waterfall' | 'hybrid';

  @IsOptional()
  @IsString()
  sprintDuration?: '1-week' | '2-weeks' | '3-weeks';
}

export class WbsChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  @IsArray()
  currentWbs: any[]; // The current WBS phases JSON

  @IsOptional()
  @IsArray()
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface WbsGenerationJobData {
  projectId: string;
  userId: string;
  instructions?: string;
  features: string[];
  teamSize?: number;
  teamRoles?: { role: string; count: number }[];
  projectStartDate?: string;
  targetEndDate?: string;
  methodology?: string;
  sprintDuration?: string;
  uploadedFilePaths: string[];
}

export interface WbsGenerationJobResult {
  phases: any[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-wbs-generation/dto/generate-wbs.dto.ts
git commit -m "feat(api): add WBS generation DTOs and types"
```

---

## Task 9: AI WBS Generation — Service

**Files:**
- Create: `apps/api/src/ai-wbs-generation/ai-wbs-generation.service.ts`

- [ ] **Step 1: Create the AI WBS generation service**

```typescript
// apps/api/src/ai-wbs-generation/ai-wbs-generation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const SYSTEM_PROMPT = `You are a Project Estimation & WBS Specialist for a project management tool.
Generate a complete Work Breakdown Structure (WBS) as structured JSON based on the user's project scope.

## CRITICAL: Output Completeness
Return a complete, valid JSON response. Do not stop mid-output.
Keep descriptions concise so you can finish the entire response.

## Estimation Methodology
Use bottom-up estimation:
1. Break features into phases (logical project stages)
2. Break phases into tasks (deliverable work items)
3. Break tasks into subtasks (atomic work units, 1-5 days each)
4. Estimate each subtask duration based on complexity and team capacity
5. Schedule tasks considering dependencies — parallel work streams for independent items
6. Calculate dates: planStart and planEnd for every phase, task, and subtask

## Scheduling Rules
- Subtasks within a task run sequentially unless they can be parallelized across different roles
- Tasks within a phase can overlap if they use different team members
- Team capacity: each role works 8 hours/day, 5 days/week
- Account for the team composition when parallelizing work
- Phase dates are derived from their tasks (earliest start → latest end)
- All dates must be ISO format: YYYY-MM-DD

## Title Format
Clean, descriptive titles only. No IDs, prefixes, or numbering.

## Output Format
Return ONLY valid JSON:
{
  "phases": [
    {
      "title": "string (max 200 chars)",
      "description": "string (brief phase description)",
      "planStart": "YYYY-MM-DD",
      "planEnd": "YYYY-MM-DD",
      "tasks": [
        {
          "title": "string (max 200 chars)",
          "description": "string (brief task description)",
          "planStart": "YYYY-MM-DD",
          "planEnd": "YYYY-MM-DD",
          "subtasks": [
            {
              "title": "string (max 200 chars)",
              "description": "string (brief subtask description)",
              "planStart": "YYYY-MM-DD",
              "planEnd": "YYYY-MM-DD"
            }
          ]
        }
      ]
    }
  ]
}`;

const CHAT_SYSTEM_PROMPT = `You are a WBS Refinement Assistant. The user has a generated WBS and wants to make changes.
You will receive the current WBS state and the user's request.
Apply the requested changes and return the FULL updated WBS as JSON (same schema as before).
Only modify what the user asks — preserve everything else.
Return ONLY valid JSON with the complete "phases" array. No markdown, no explanation — just JSON.`;

@Injectable()
export class AiWbsGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig?.workspacePath ?? process.cwd(),
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
    };
  }

  buildGenerationPrompt(opts: {
    features: string[];
    instructions?: string;
    teamSize?: number;
    teamRoles?: { role: string; count: number }[];
    projectStartDate?: string;
    targetEndDate?: string;
    methodology?: string;
    sprintDuration?: string;
    projectContext: string | null;
    fileContents?: string;
  }): string {
    const parts: string[] = [SYSTEM_PROMPT];

    // Team info
    if (opts.teamSize || opts.teamRoles?.length) {
      parts.push('\n## Team Composition');
      if (opts.teamSize) parts.push(`Total team size: ${opts.teamSize}`);
      if (opts.teamRoles?.length) {
        const roleList = opts.teamRoles.map((r) => `- ${r.role}: ${r.count} person(s)`).join('\n');
        parts.push(`Roles:\n${roleList}`);
      }
    }

    // Constraints
    parts.push('\n## Project Constraints');
    if (opts.projectStartDate) parts.push(`Project start date: ${opts.projectStartDate}`);
    if (opts.targetEndDate) parts.push(`Target end date: ${opts.targetEndDate}`);
    if (opts.methodology) parts.push(`Methodology: ${opts.methodology}`);
    if (opts.sprintDuration) parts.push(`Sprint duration: ${opts.sprintDuration}`);

    // Project context
    if (opts.projectContext) {
      parts.push(`\n## Project Context\n${opts.projectContext}`);
    }

    // File contents
    if (opts.fileContents) {
      parts.push(`\n## Uploaded Scope Document\n${opts.fileContents}`);
    }

    // Features
    if (opts.features.length > 0) {
      const featureList = opts.features.map((f, i) => `${i + 1}. ${f}`).join('\n');
      parts.push(`\n## Features / Scope Items\n${featureList}`);
    }

    // Additional instructions
    if (opts.instructions) {
      parts.push(`\n## Additional Instructions\n${opts.instructions}`);
    }

    return parts.join('\n');
  }

  buildChatPrompt(currentWbs: any[], message: string, chatHistory?: { role: string; content: string }[]): string {
    const parts: string[] = [CHAT_SYSTEM_PROMPT];

    parts.push(`\n## Current WBS State\n${JSON.stringify({ phases: currentWbs }, null, 2)}`);

    if (chatHistory?.length) {
      const historyText = chatHistory
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');
      parts.push(`\n## Conversation History\n${historyText}`);
    }

    parts.push(`\n## User Request\n${message}`);

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string): string[] {
    switch (provider) {
      case 'claude':
        return ['--dangerously-skip-permissions', '-p', prompt, '--output-format', 'text', '--model', model];
      case 'gemini':
        return ['-p', prompt, '--model', model];
      case 'codex':
        return ['-p', prompt, '--model', model];
      default:
        return ['-p', prompt];
    }
  }

  buildCliEnv(provider: string, apiKey: string): Record<string, string> {
    switch (provider) {
      case 'claude':
        return { CLAUDE_CODE_OAUTH_TOKEN: apiKey };
      case 'gemini':
        return { GEMINI_API_KEY: apiKey };
      case 'codex':
        return { OPENAI_API_KEY: apiKey };
      default:
        return {};
    }
  }

  parseAndValidateOutput(raw: string): { phases: any[] } {
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('AI returned invalid JSON. Raw output: ' + raw.slice(0, 500));
    }

    if (!parsed.phases || !Array.isArray(parsed.phases)) {
      throw new Error('AI output missing "phases" array');
    }

    // Validate and truncate titles
    for (const phase of parsed.phases) {
      if (!phase.title) throw new Error('Phase missing title');
      if (phase.title.length > 200) phase.title = phase.title.slice(0, 200);
      if (phase.tasks) {
        for (const task of phase.tasks) {
          if (!task.title) throw new Error('Task missing title');
          if (task.title.length > 200) task.title = task.title.slice(0, 200);
          if (task.subtasks) {
            for (const subtask of task.subtasks) {
              if (!subtask.title) throw new Error('Subtask missing title');
              if (subtask.title.length > 200) subtask.title = subtask.title.slice(0, 200);
            }
          }
        }
      }
    }

    return { phases: parsed.phases };
  }

  async readUploadedFiles(filePaths: string[]): Promise<string> {
    if (filePaths.length === 0) return '';
    const { readFile } = await import('fs/promises');
    const contents: string[] = [];
    for (const fp of filePaths) {
      try {
        const content = await readFile(fp, 'utf-8');
        contents.push(`### File: ${fp}\n${content}`);
      } catch {
        contents.push(`### File: ${fp}\n[Binary file — cannot extract text]`);
      }
    }
    return contents.join('\n\n');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-wbs-generation/ai-wbs-generation.service.ts
git commit -m "feat(api): add AiWbsGenerationService with prompt building and parsing"
```

---

## Task 10: AI WBS Generation — Processor (Job Queue)

**Files:**
- Create: `apps/api/src/ai-wbs-generation/ai-wbs-generation.processor.ts`

- [ ] **Step 1: Create the BullMQ processor**

```typescript
// apps/api/src/ai-wbs-generation/ai-wbs-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { NotificationsService } from '../notifications/notifications.service';
import { AiWbsGenerationService } from './ai-wbs-generation.service';
import type { WbsGenerationJobData, WbsGenerationJobResult } from './dto/generate-wbs.dto';

@Processor('ai-wbs-generation', { concurrency: 2 })
export class AiWbsGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiWbsGenerationProcessor.name);

  constructor(
    private readonly aiService: AiWbsGenerationService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  private runCliStreaming(
    command: string,
    args: string[],
    opts: { cwd: string; timeout: number; env?: Record<string, string | undefined> },
    jobId: string | undefined,
    onChunk?: (text: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: opts.cwd,
        env: opts.env as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        reject(new Error(`CLI timed out after ${opts.timeout}ms`));
      }, opts.timeout);

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        onChunk?.(text);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        onChunk?.(chunk.toString());
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0 || code === null) {
          resolve(stdoutChunks.join(''));
        } else {
          reject(new Error(`CLI exited with code ${code}`));
        }
      });
    });
  }

  private emitStep(userId: string, job: Job<WbsGenerationJobData>, step: string): void {
    this.notifications.notifyUser(userId, 'ai-wbs-generation:progress', {
      jobId: job.id,
      step,
    });
    void job.updateProgress({ step });
  }

  async process(job: Job<WbsGenerationJobData>): Promise<WbsGenerationJobResult> {
    const data = job.data;
    let logBuffer = '';
    let currentStep = 'queued';

    const emitStream = (chunk: string) => {
      logBuffer += chunk;
      this.notifications.notifyUser(data.userId, 'ai-wbs-generation:stream', {
        jobId: job.id,
        rawText: logBuffer,
      });
      void job.updateProgress({ step: currentStep, streamText: logBuffer });
    };

    try {
      const config = await this.aiService.getProjectAiConfig(data.projectId);

      // Read uploaded files if any
      const fileContents = await this.aiService.readUploadedFiles(data.uploadedFilePaths);

      // Generate WBS
      currentStep = 'generating';
      this.emitStep(data.userId, job, 'generating');
      emitStream(`$ ${config.cli} (generating WBS breakdown)\n`);

      const prompt = this.aiService.buildGenerationPrompt({
        features: data.features,
        instructions: data.instructions,
        teamSize: data.teamSize,
        teamRoles: data.teamRoles,
        projectStartDate: data.projectStartDate,
        targetEndDate: data.targetEndDate,
        methodology: data.methodology,
        sprintDuration: data.sprintDuration,
        projectContext: config.projectContext,
        fileContents: fileContents || undefined,
      });

      const args = this.aiService.buildCliArgs(config.provider, config.model, prompt);
      const env = this.aiService.buildCliEnv(config.provider, config.apiKey);

      const rawOutput = await this.runCliStreaming(config.cli, args, {
        cwd: config.workspacePath,
        timeout: 600_000,
        env: { ...process.env, ...env },
      }, job.id, emitStream);

      // Parse
      currentStep = 'parsing';
      this.emitStep(data.userId, job, 'parsing');
      emitStream('\nParsing AI output...\n');

      const result = this.aiService.parseAndValidateOutput(rawOutput);
      const taskCount = result.phases.reduce(
        (sum, p) => sum + (p.tasks?.length ?? 0),
        0,
      );

      emitStream(`Done — generated ${result.phases.length} phase(s), ${taskCount} task(s).\n`);

      this.notifications.notifyUser(data.userId, 'ai-wbs-generation:completed', {
        jobId: job.id,
        phaseCount: result.phases.length,
        taskCount,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      this.logger.error(`[Job ${job.id}] Failed: ${message}`);

      emitStream(`\nError: ${message}\n`);

      this.notifications.notifyUser(data.userId, 'ai-wbs-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-wbs-generation/ai-wbs-generation.processor.ts
git commit -m "feat(api): add AiWbsGenerationProcessor for BullMQ job queue"
```

---

## Task 11: AI WBS Generation — Controller & Chat Endpoint

**Files:**
- Create: `apps/api/src/ai-wbs-generation/ai-wbs-generation.controller.ts`

- [ ] **Step 1: Create the controller with generate and chat endpoints**

```typescript
// apps/api/src/ai-wbs-generation/ai-wbs-generation.controller.ts
import {
  Controller, Post, Get, Param, Body, Req,
  UseGuards, UseInterceptors, UploadedFiles,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { GenerateWbsDto, WbsChatDto } from './dto/generate-wbs.dto';
import { AiWbsGenerationService } from './ai-wbs-generation.service';
import type { WbsGenerationJobData } from './dto/generate-wbs.dto';

@Controller('projects/:projectId/ai')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AiWbsGenerationController {
  constructor(
    @InjectQueue('ai-wbs-generation') private readonly queue: Queue,
    private readonly aiService: AiWbsGenerationService,
  ) {}

  @Post('generate-wbs')
  @UseInterceptors(
    FilesInterceptor('documents', 1, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const jobId = randomUUID();
          (_req as any).__wbsJobId = (_req as any).__wbsJobId || jobId;
          const dir = join(process.cwd(), 'uploads', 'ai-wbs-generation', (_req as any).__wbsJobId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv', '.txt', '.pdf', '.docx', '.md'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${ext} not supported`), false);
        }
      },
    }),
  )
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateWbsDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const features = dto.features ?? [];
    const hasFile = (files ?? []).length > 0;
    if (features.length === 0 && !hasFile && !dto.instructions) {
      throw new BadRequestException('Provide at least one feature, an uploaded file, or instructions');
    }

    const uploadedFilePaths = (files ?? []).map((f) => f.path);
    const jobId = (req as any).__wbsJobId || randomUUID();

    let teamRoles: { role: string; count: number }[] | undefined;
    if (dto.teamRoles) {
      teamRoles = Array.isArray(dto.teamRoles)
        ? dto.teamRoles
        : JSON.parse(dto.teamRoles as any);
    }

    const jobData: WbsGenerationJobData = {
      projectId,
      userId: req.user.id,
      instructions: dto.instructions,
      features,
      teamSize: dto.teamSize,
      teamRoles,
      projectStartDate: dto.projectStartDate,
      targetEndDate: dto.targetEndDate,
      methodology: dto.methodology,
      sprintDuration: dto.sprintDuration,
      uploadedFilePaths,
    };

    const job = await this.queue.add('generate-wbs', jobData, {
      jobId,
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get('wbs-generation/:jobId')
  async getJobResult(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('WBS generation job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', phases: job.returnvalue?.phases ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Unknown error' };
    }

    const progress = job.progress as { step?: string; streamText?: string } | undefined;
    return {
      status: state,
      step: progress?.step ?? 'queued',
      ...(progress?.streamText ? { rawText: progress.streamText } : {}),
    };
  }

  @Post('wbs-chat')
  async chat(
    @Param('projectId') projectId: string,
    @Body() dto: WbsChatDto,
    @Req() req: any,
  ) {
    const config = await this.aiService.getProjectAiConfig(projectId);

    const prompt = this.aiService.buildChatPrompt(
      dto.currentWbs,
      dto.message,
      dto.chatHistory,
    );

    const args = this.aiService.buildCliArgs(config.provider, config.model, prompt);
    const env = this.aiService.buildCliEnv(config.provider, config.apiKey);

    // Run synchronously — chat responses are faster than full generation
    const rawOutput = await new Promise<string>((resolve, reject) => {
      const child = spawn(config.cli, args, {
        cwd: config.workspacePath,
        env: { ...process.env, ...env } as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const chunks: string[] = [];
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        reject(new Error('Chat timed out'));
      }, 300_000);

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
      child.stderr.on('data', () => {}); // Ignore stderr
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0 || code === null) resolve(chunks.join(''));
        else reject(new Error(`CLI exited with code ${code}`));
      });
    });

    const result = this.aiService.parseAndValidateOutput(rawOutput);
    return { phases: result.phases };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-wbs-generation/ai-wbs-generation.controller.ts
git commit -m "feat(api): add AiWbsGenerationController with generate and chat endpoints"
```

---

## Task 12: AI WBS Generation — Module & Registration

**Files:**
- Create: `apps/api/src/ai-wbs-generation/ai-wbs-generation.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

```typescript
// apps/api/src/ai-wbs-generation/ai-wbs-generation.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiWbsGenerationController } from './ai-wbs-generation.controller';
import { AiWbsGenerationService } from './ai-wbs-generation.service';
import { AiWbsGenerationProcessor } from './ai-wbs-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-wbs-generation' }),
  ],
  controllers: [AiWbsGenerationController],
  providers: [AiWbsGenerationService, AiWbsGenerationProcessor],
})
export class AiWbsGenerationModule {}
```

- [ ] **Step 2: Register in app.module.ts**

Add the import at the top of `apps/api/src/app.module.ts`:

```typescript
import { AiWbsGenerationModule } from './ai-wbs-generation/ai-wbs-generation.module';
```

Add `AiWbsGenerationModule` to the `imports` array in the `@Module` decorator, after `AiTestCaseGenerationModule`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ai-wbs-generation/ai-wbs-generation.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): register AiWbsGenerationModule in app"
```

---

## Task 13: Frontend — AI Generation Hook

**Files:**
- Create: `apps/web/src/hooks/useAiWbsGeneration.ts`

- [ ] **Step 1: Create the hook following existing AI generation pattern**

```typescript
// apps/web/src/hooks/useAiWbsGeneration.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type { AiGenerationStep } from '../lib/types';

export function useAiWbsGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';

  const generate = useMutation({
    mutationFn: (formData: FormData) => api.generateWbs(projectId, formData),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setErrorMessage(null);
      toast.info('AI WBS generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  const jobResult = useQuery({
    queryKey: ['ai-wbs-generation', projectId, jobId],
    queryFn: () => api.getWbsGenerationResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

  const jobStatus = useQuery({
    queryKey: ['ai-wbs-generation-status', projectId, jobId],
    queryFn: () => api.getWbsGenerationResult(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!jobStatus.data) return;
    const data = jobStatus.data;
    if (data.status === 'completed') {
      setStep('completed');
    } else if (data.status === 'failed') {
      setStep('failed');
      setErrorMessage(data.error ?? 'Unknown error');
    } else {
      if (data.step) setStep(data.step);
      if (data.rawText) setRawText(data.rawText);
    }
  }, [jobStatus.data]);

  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: AiGenerationStep }) => {
      if (data.jobId === jobId) setStep(data.step);
    };
    const onCompleted = (data: { jobId: string; phaseCount: number; taskCount: number }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        toast.success(`Generated ${data.phaseCount} phases, ${data.taskCount} tasks`);
      }
    };
    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        setErrorMessage(data.error);
        toast.error(`Generation failed: ${data.error}`);
      }
    };
    const onStream = (data: { jobId: string; rawText?: string }) => {
      if (data.jobId === jobId && data.rawText) setRawText(data.rawText);
    };

    socket.on('ai-wbs-generation:progress', onProgress);
    socket.on('ai-wbs-generation:completed', onCompleted);
    socket.on('ai-wbs-generation:failed', onFailed);
    socket.on('ai-wbs-generation:stream', onStream);

    return () => {
      socket.off('ai-wbs-generation:progress', onProgress);
      socket.off('ai-wbs-generation:completed', onCompleted);
      socket.off('ai-wbs-generation:failed', onFailed);
      socket.off('ai-wbs-generation:stream', onStream);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setErrorMessage(null);
    setRawText('');
    void queryClient.removeQueries({ queryKey: ['ai-wbs-generation', projectId] });
    void queryClient.removeQueries({ queryKey: ['ai-wbs-generation-status', projectId] });
  }, [projectId, queryClient]);

  return {
    generate,
    jobId,
    step,
    rawText,
    phases: jobResult.data?.phases ?? [],
    isLoading: generate.isPending || isActive,
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: errorMessage ?? jobResult.data?.error ?? null,
    reset,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useAiWbsGeneration.ts
git commit -m "feat(web): add useAiWbsGeneration hook with Socket.IO streaming"
```

---

## Task 14: Frontend — API Client for AI WBS

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Add WBS generation types to types.ts**

Add after the `BulkCreateWbsPayload` interface:

```typescript
// ─── AI WBS Generation Types ──────────────────────────────

export interface AiWbsGenerationJobResult {
  status: 'completed' | 'failed' | string;
  phases?: any[];
  error?: string;
  step?: string;
  rawText?: string;
}

export interface WbsChatResponse {
  phases: any[];
}
```

- [ ] **Step 2: Add API methods to api.ts**

Add the import of `AiWbsGenerationJobResult` and `WbsChatResponse` at the top of `api.ts`.

Add these methods after the `getTestCaseGenerationJobResult` entry (around line 431):

```typescript
  // ─── AI WBS Generation ──────────────────────────────────────────────────
  generateWbs: async (projectId: string, data: FormData): Promise<{ jobId: string }> => {
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/ai/generate-wbs`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Generation failed: ${res.status}`);
    }
    return res.json() as Promise<{ jobId: string }>;
  },
  getWbsGenerationResult: (projectId: string, jobId: string) =>
    request<AiWbsGenerationJobResult>(`/projects/${projectId}/ai/wbs-generation/${jobId}`),
  wbsChat: (projectId: string, data: { message: string; currentWbs: any[]; chatHistory?: { role: string; content: string }[] }) =>
    request<WbsChatResponse>(`/projects/${projectId}/ai/wbs-chat`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(web): add AI WBS generation API client and types"
```

---

## Task 15: Frontend — Wizard Step Components

**Files:**
- Create: `apps/web/src/components/wbs/wizard/WizardScopeStep.tsx`
- Create: `apps/web/src/components/wbs/wizard/WizardTeamStep.tsx`
- Create: `apps/web/src/components/wbs/wizard/WizardConstraintsStep.tsx`
- Create: `apps/web/src/components/wbs/wizard/WizardReviewStep.tsx`

- [ ] **Step 1: Create WizardScopeStep**

```typescript
// apps/web/src/components/wbs/wizard/WizardScopeStep.tsx
import { useState } from 'react';
import { Upload, Plus, X, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface ScopeData {
  features: string[];
  instructions: string;
  file: File | null;
}

interface Props {
  data: ScopeData;
  onChange: (data: ScopeData) => void;
}

export function WizardScopeStep({ data, onChange }: Props) {
  const [newFeature, setNewFeature] = useState('');

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (!trimmed) return;
    onChange({ ...data, features: [...data.features, trimmed] });
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    onChange({ ...data, features: data.features.filter((_, i) => i !== index) });
  };

  const handleFile = (file: File) => {
    onChange({ ...data, file });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Upload Excel (optional)</Label>
        <div
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('wbs-wizard-file')?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
        >
          {data.file ? (
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-green-600" />
              <span className="text-sm">{data.file.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => { e.stopPropagation(); onChange({ ...data, file: null }); }}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Drop .xlsx here or click to browse</span>
            </>
          )}
          <input
            id="wbs-wizard-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Features / Scope Items</Label>
        <div className="space-y-1.5">
          {data.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm">
              <span className="flex-1">{f}</span>
              <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a feature or scope item..."
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={addFeature} disabled={!newFeature.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Additional Instructions</Label>
        <Textarea
          value={data.instructions}
          onChange={(e) => onChange({ ...data, instructions: e.target.value })}
          placeholder="E.g., Focus on MVP features first, use microservice architecture..."
          rows={3}
          className="text-sm"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WizardTeamStep**

```typescript
// apps/web/src/components/wbs/wizard/WizardTeamStep.tsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface TeamData {
  teamSize: number;
  roles: { role: string; count: number }[];
}

interface Props {
  data: TeamData;
  onChange: (data: TeamData) => void;
}

const PRESET_ROLES = ['Frontend Developer', 'Backend Developer', 'QA Engineer', 'DevOps', 'Project Manager', 'UI/UX Designer'];

export function WizardTeamStep({ data, onChange }: Props) {
  const [newRole, setNewRole] = useState('');

  const addRole = (roleName: string) => {
    const trimmed = roleName.trim();
    if (!trimmed || data.roles.some((r) => r.role === trimmed)) return;
    onChange({ ...data, roles: [...data.roles, { role: trimmed, count: 1 }] });
    setNewRole('');
  };

  const removeRole = (index: number) => {
    onChange({ ...data, roles: data.roles.filter((_, i) => i !== index) });
  };

  const updateRoleCount = (index: number, count: number) => {
    const roles = [...data.roles];
    roles[index] = { ...roles[index], count: Math.max(1, count) };
    onChange({ ...data, roles });
  };

  const unusedPresets = PRESET_ROLES.filter((p) => !data.roles.some((r) => r.role === p));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Total Team Size</Label>
        <Input
          type="number"
          min={1}
          value={data.teamSize}
          onChange={(e) => onChange({ ...data, teamSize: parseInt(e.target.value) || 1 })}
          className="w-24 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Roles</Label>
        <div className="space-y-1.5">
          {data.roles.map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded border px-3 py-1.5">
              <span className="flex-1 text-sm">{r.role}</span>
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                min={1}
                value={r.count}
                onChange={(e) => updateRoleCount(i, parseInt(e.target.value) || 1)}
                className="w-16 h-7 text-sm text-center"
              />
              <button onClick={() => removeRole(i)} className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add custom role..."
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(newRole); } }}
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => addRole(newRole)} disabled={!newRole.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </div>

        {unusedPresets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {unusedPresets.map((p) => (
              <button
                key={p}
                onClick={() => addRole(p)}
                className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WizardConstraintsStep**

```typescript
// apps/web/src/components/wbs/wizard/WizardConstraintsStep.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ConstraintsData {
  projectStartDate: string;
  targetEndDate: string;
  methodology: 'agile' | 'waterfall' | 'hybrid';
  sprintDuration: '1-week' | '2-weeks' | '3-weeks';
}

interface Props {
  data: ConstraintsData;
  onChange: (data: ConstraintsData) => void;
}

const METHODOLOGIES = [
  { value: 'agile' as const, label: 'Agile' },
  { value: 'waterfall' as const, label: 'Waterfall' },
  { value: 'hybrid' as const, label: 'Hybrid' },
];

const SPRINT_DURATIONS = [
  { value: '1-week' as const, label: '1 week' },
  { value: '2-weeks' as const, label: '2 weeks' },
  { value: '3-weeks' as const, label: '3 weeks' },
];

export function WizardConstraintsStep({ data, onChange }: Props) {
  const showSprint = data.methodology === 'agile' || data.methodology === 'hybrid';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Project Start Date</Label>
        <Input
          type="date"
          value={data.projectStartDate}
          onChange={(e) => onChange({ ...data, projectStartDate: e.target.value })}
          className="w-48 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Target End Date (optional)</Label>
        <Input
          type="date"
          value={data.targetEndDate}
          onChange={(e) => onChange({ ...data, targetEndDate: e.target.value })}
          className="w-48 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Methodology</Label>
        <div className="flex gap-2">
          {METHODOLOGIES.map((m) => (
            <button
              key={m.value}
              onClick={() => onChange({ ...data, methodology: m.value })}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                data.methodology === m.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showSprint && (
        <div className="space-y-2">
          <Label>Sprint Duration</Label>
          <div className="flex gap-2">
            {SPRINT_DURATIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => onChange({ ...data, sprintDuration: s.value })}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  data.sprintDuration === s.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create WizardReviewStep**

```typescript
// apps/web/src/components/wbs/wizard/WizardReviewStep.tsx
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScopeData } from './WizardScopeStep';
import type { TeamData } from './WizardTeamStep';
import type { ConstraintsData } from './WizardConstraintsStep';

interface Props {
  scope: ScopeData;
  team: TeamData;
  constraints: ConstraintsData;
  onGenerate: () => void;
  isGenerating: boolean;
  rawText: string;
}

export function WizardReviewStep({ scope, team, constraints, onGenerate, isGenerating, rawText }: Props) {
  if (isGenerating) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-purple-500 animate-pulse" />
          Generating WBS...
        </div>
        <pre className="rounded border bg-muted/50 p-3 text-xs font-mono max-h-64 overflow-auto whitespace-pre-wrap">
          {rawText || 'Starting AI generation...'}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
        <h4 className="font-semibold">Summary</h4>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted-foreground">
          <span>Features:</span>
          <span className="text-foreground">
            {scope.features.length > 0 ? `${scope.features.length} features` : 'From uploaded file'}
            {scope.file && ` + ${scope.file.name}`}
          </span>
          <span>Team:</span>
          <span className="text-foreground">
            {team.teamSize} members, {team.roles.length} roles
          </span>
          <span>Timeline:</span>
          <span className="text-foreground">
            {constraints.projectStartDate || 'Not set'}
            {constraints.targetEndDate ? ` → ${constraints.targetEndDate}` : ' → open-ended'}
          </span>
          <span>Method:</span>
          <span className="text-foreground capitalize">
            {constraints.methodology}
            {(constraints.methodology === 'agile' || constraints.methodology === 'hybrid')
              ? `, ${constraints.sprintDuration.replace('-', ' ')} sprints`
              : ''}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 p-3 text-xs text-muted-foreground">
        AI will use project estimation techniques to calculate durations and schedule tasks
        across your team with parallel work streams where possible.
      </div>

      <div className="flex justify-center pt-2">
        <Button onClick={onGenerate} size="lg" className="gap-2">
          <Sparkles className="size-4" />
          Generate WBS
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wbs/wizard/
git commit -m "feat(web): add wizard step components (Scope, Team, Constraints, Review)"
```

---

## Task 16: Frontend — WBS Tree Preview & Chat Panel

**Files:**
- Create: `apps/web/src/components/wbs/wizard/WbsTreePreview.tsx`
- Create: `apps/web/src/components/wbs/wizard/WizardChatPanel.tsx`
- Create: `apps/web/src/components/wbs/wizard/WizardPreviewChat.tsx`

- [ ] **Step 1: Create WbsTreePreview**

```typescript
// apps/web/src/components/wbs/wizard/WbsTreePreview.tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  phases: any[];
}

export function WbsTreePreview({ phases }: Props) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const taskCount = phases.reduce((sum, p) => sum + (p.tasks?.length ?? 0), 0);
  const subtaskCount = phases.reduce(
    (sum, p) => sum + (p.tasks ?? []).reduce((s: number, t: any) => s + (t.subtasks?.length ?? 0), 0),
    0,
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Generated WBS Preview</span>
        <div className="flex gap-1.5">
          <Badge variant="secondary" className="text-[10px]">{phases.length} phases</Badge>
          <Badge variant="secondary" className="text-[10px]">{taskCount} tasks</Badge>
          <Badge variant="secondary" className="text-[10px]">{subtaskCount} subtasks</Badge>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 text-xs">
        {phases.map((phase, pi) => {
          const phaseId = `phase-${pi}`;
          const isCollapsed = collapsedIds.has(phaseId);
          return (
            <div key={pi} className="mb-1">
              <button
                onClick={() => toggle(phaseId)}
                className="flex items-center gap-1.5 w-full rounded px-2 py-1.5 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 text-left"
              >
                {isCollapsed ? <ChevronRight className="size-3 text-purple-600" /> : <ChevronDown className="size-3 text-purple-600" />}
                <span className="font-semibold text-purple-700 dark:text-purple-300 flex-1">{phase.title}</span>
                <span className="text-muted-foreground">{phase.planStart} → {phase.planEnd}</span>
              </button>
              {!isCollapsed && (phase.tasks ?? []).map((task: any, ti: number) => {
                const taskId = `task-${pi}-${ti}`;
                const taskCollapsed = collapsedIds.has(taskId);
                return (
                  <div key={ti} className="ml-4">
                    <button
                      onClick={() => toggle(taskId)}
                      className="flex items-center gap-1.5 w-full rounded px-2 py-1 hover:bg-muted text-left"
                    >
                      {task.subtasks?.length ? (
                        taskCollapsed ? <ChevronRight className="size-3 text-blue-500" /> : <ChevronDown className="size-3 text-blue-500" />
                      ) : <span className="w-3" />}
                      <span className="flex-1">{task.title}</span>
                      <span className="text-muted-foreground">{task.planStart} → {task.planEnd}</span>
                    </button>
                    {!taskCollapsed && (task.subtasks ?? []).map((sub: any, si: number) => (
                      <div key={si} className="ml-8 flex items-center gap-1.5 px-2 py-0.5 text-muted-foreground">
                        <span className="text-indigo-400">↳</span>
                        <span className="flex-1">{sub.title}</span>
                        <span>{sub.planStart} → {sub.planEnd}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WizardChatPanel**

```typescript
// apps/web/src/components/wbs/wizard/WizardChatPanel.tsx
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function WizardChatPanel({ messages, onSend, isLoading }: Props) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="px-3 py-2 border-b text-sm font-semibold">Refine with AI</div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block rounded-lg px-3 py-2 text-xs max-w-[90%] text-left ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Thinking...
          </div>
        )}
      </div>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
            placeholder="Ask AI to adjust the WBS..."
            className="text-xs"
            disabled={isLoading}
          />
          <Button size="sm" onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WizardPreviewChat (combines tree preview + chat)**

```typescript
// apps/web/src/components/wbs/wizard/WizardPreviewChat.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { WbsTreePreview } from './WbsTreePreview';
import { WizardChatPanel } from './WizardChatPanel';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  projectId: string;
  phases: any[];
  onPhasesUpdate: (phases: any[]) => void;
  onImport: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export function WizardPreviewChat({ projectId, phases, onPhasesUpdate, onImport, onCancel, isImporting }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `I've generated a WBS with ${phases.length} phases. What would you like to adjust?`,
    },
  ]);

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.wbsChat(projectId, {
        message,
        currentWbs: phases,
        chatHistory: messages,
      }),
    onSuccess: (data) => {
      onPhasesUpdate(data.phases);
      const taskCount = data.phases.reduce((sum: number, p: any) => sum + (p.tasks?.length ?? 0), 0);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Updated! Now ${data.phases.length} phases with ${taskCount} tasks.` },
      ]);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}. Please try again.` },
      ]);
    },
  });

  const handleSend = (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    chatMutation.mutate(message);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden grid grid-cols-[1fr_350px] min-h-0">
        <div className="overflow-auto border-r">
          <WbsTreePreview phases={phases} />
        </div>
        <div className="overflow-hidden">
          <WizardChatPanel
            messages={messages}
            onSend={handleSend}
            isLoading={chatMutation.isPending}
          />
        </div>
      </div>
      <div className="flex gap-2 p-3 border-t">
        <Button onClick={onImport} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import to WBS'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wbs/wizard/WbsTreePreview.tsx apps/web/src/components/wbs/wizard/WizardChatPanel.tsx apps/web/src/components/wbs/wizard/WizardPreviewChat.tsx
git commit -m "feat(web): add WBS tree preview, chat panel, and preview+chat container"
```

---

## Task 17: Frontend — Main AI Wizard Container

**Files:**
- Create: `apps/web/src/components/wbs/WbsAiWizard.tsx`

- [ ] **Step 1: Create the wizard container with step navigation**

```typescript
// apps/web/src/components/wbs/WbsAiWizard.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WizardScopeStep, type ScopeData } from './wizard/WizardScopeStep';
import { WizardTeamStep, type TeamData } from './wizard/WizardTeamStep';
import { WizardConstraintsStep, type ConstraintsData } from './wizard/WizardConstraintsStep';
import { WizardReviewStep } from './wizard/WizardReviewStep';
import { WizardPreviewChat } from './wizard/WizardPreviewChat';
import { useAiWbsGeneration } from '@/hooks/useAiWbsGeneration';
import { useBulkCreateWbs } from '@/hooks/useWbs';

const STEPS = ['Scope', 'Team', 'Constraints', 'Generate'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function WbsAiWizard({ open, onClose, projectId }: Props) {
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<ScopeData>({ features: [], instructions: '', file: null });
  const [team, setTeam] = useState<TeamData>({ teamSize: 5, roles: [] });
  const [constraints, setConstraints] = useState<ConstraintsData>({
    projectStartDate: new Date().toISOString().slice(0, 10),
    targetEndDate: '',
    methodology: 'agile',
    sprintDuration: '2-weeks',
  });
  const [generatedPhases, setGeneratedPhases] = useState<any[] | null>(null);

  const aiGen = useAiWbsGeneration(projectId);
  const bulkCreate = useBulkCreateWbs(projectId);

  const handleGenerate = () => {
    const formData = new FormData();
    if (scope.file) formData.append('documents', scope.file);
    if (scope.features.length > 0) {
      scope.features.forEach((f) => formData.append('features', f));
    }
    if (scope.instructions) formData.append('instructions', scope.instructions);
    if (team.teamSize) formData.append('teamSize', String(team.teamSize));
    if (team.roles.length > 0) formData.append('teamRoles', JSON.stringify(team.roles));
    if (constraints.projectStartDate) formData.append('projectStartDate', constraints.projectStartDate);
    if (constraints.targetEndDate) formData.append('targetEndDate', constraints.targetEndDate);
    formData.append('methodology', constraints.methodology);
    formData.append('sprintDuration', constraints.sprintDuration);

    aiGen.generate.mutate(formData);
  };

  // Transition to preview when generation completes
  if (aiGen.isCompleted && !generatedPhases && aiGen.phases.length > 0) {
    setGeneratedPhases(aiGen.phases);
  }

  const handleImport = () => {
    if (!generatedPhases) return;
    bulkCreate.mutate({ phases: generatedPhases }, {
      onSuccess: () => {
        handleClose();
      },
    });
  };

  const handleClose = () => {
    setStep(0);
    setScope({ features: [], instructions: '', file: null });
    setTeam({ teamSize: 5, roles: [] });
    setConstraints({
      projectStartDate: new Date().toISOString().slice(0, 10),
      targetEndDate: '',
      methodology: 'agile',
      sprintDuration: '2-weeks',
    });
    setGeneratedPhases(null);
    aiGen.reset();
    onClose();
  };

  const canProceed = step === 0
    ? scope.features.length > 0 || scope.file !== null
    : step === 1
    ? team.teamSize > 0
    : step === 2
    ? !!constraints.projectStartDate
    : true;

  // Show preview+chat mode after generation
  if (generatedPhases) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>AI WBS Suggestion — Preview & Refine</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <WizardPreviewChat
              projectId={projectId}
              phases={generatedPhases}
              onPhasesUpdate={setGeneratedPhases}
              onImport={handleImport}
              onCancel={handleClose}
              isImporting={bulkCreate.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI WBS Suggestion</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-0.5 bg-muted" />}
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === step
                      ? 'bg-primary text-primary-foreground'
                      : i < step
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs ${i === step ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-auto py-2">
          {step === 0 && <WizardScopeStep data={scope} onChange={setScope} />}
          {step === 1 && <WizardTeamStep data={team} onChange={setTeam} />}
          {step === 2 && <WizardConstraintsStep data={constraints} onChange={setConstraints} />}
          {step === 3 && (
            <WizardReviewStep
              scope={scope}
              team={team}
              constraints={constraints}
              onGenerate={handleGenerate}
              isGenerating={aiGen.isLoading}
              rawText={aiGen.rawText}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || aiGen.isLoading}
          >
            <ChevronLeft className="size-4 mr-1" /> Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={!canProceed}
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose} disabled={aiGen.isLoading}>
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/wbs/WbsAiWizard.tsx
git commit -m "feat(web): add WbsAiWizard container with step navigation"
```

---

## Task 18: Wire AI Wizard into WbsPage

**Files:**
- Modify: `apps/web/src/pages/WbsPage.tsx`

- [ ] **Step 1: Add the AI wizard import and wire the onAiSuggest prop**

Add import at the top:

```typescript
import { WbsAiWizard } from '@/components/wbs/WbsAiWizard';
```

Update the `onAiSuggest` prop on `WbsToolbar` from the placeholder:

```tsx
onAiSuggest={() => setShowAiWizard(true)}
```

Add the wizard dialog before the closing `</div>` (after `WbsImportDialog`):

```tsx
<WbsAiWizard
  open={showAiWizard}
  onClose={() => setShowAiWizard(false)}
  projectId={projectId}
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/WbsPage.tsx
git commit -m "feat(web): wire AI WBS wizard into WbsPage"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Verify API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify Web compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify the app builds**

Run: `cd apps/web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve compilation issues for WBS import/AI features"
```
