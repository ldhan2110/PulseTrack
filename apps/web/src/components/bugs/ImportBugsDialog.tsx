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
      <DialogContent className="w-fit max-w-0 max-h-[85vh] flex flex-col" style={{ maxWidth: "none" }}>
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
