import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import { useBulkCreateWbs } from '@/hooks/useWbs';
import { parseWbsExcel, type ImportParseResult } from '@/lib/importWbs';

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

const LEVEL_BADGE_CLASS: Record<0 | 1 | 2, string> = {
  0: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  1: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  2: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
};

const LEVEL_INDENT: Record<0 | 1 | 2, string> = {
  0: 'pl-0',
  1: 'pl-4',
  2: 'pl-8',
};

export function WbsImportDialog({ open, onClose, projectId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const bulkCreate = useBulkCreateWbs(projectId);

  function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      setParseError('Only .xlsx files are supported.');
      return;
    }
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseWbsExcel(buffer);
        setParseResult(result);
        setFileName(file.name);
      } catch (err) {
        setParseError('Failed to parse file. Please ensure it is a valid WBS Excel export.');
        setParseResult(null);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleClear() {
    setParseResult(null);
    setFileName(null);
    setParseError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleImport() {
    if (!parseResult) return;
    bulkCreate.mutate(parseResult.payload, {
      onSuccess: () => {
        handleClear();
        onClose();
      },
    });
  }

  function handleClose() {
    handleClear();
    onClose();
  }

  const totalItems = parseResult?.previewRows.filter((r) => !r.error?.startsWith('Auto-created')).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import WBS from Excel</DialogTitle>
        </DialogHeader>

        {/* Dropzone — shown when no file selected */}
        {!parseResult && (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer
              ${dragging ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/30 hover:border-blue-400 hover:bg-muted/30'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop an Excel file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts .xlsx files exported from WBS</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        {/* Parse error */}
        {parseError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {parseError}
          </div>
        )}

        {/* Preview table — shown after successful parse */}
        {parseResult && (
          <div className="flex flex-col gap-3">
            {/* File info bar */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="size-4 text-green-600" />
                <span className="font-medium truncate max-w-xs">{fileName}</span>
                <span className="text-muted-foreground">
                  — {totalItems} items
                  {parseResult.errors > 0 && (
                    <span className="text-amber-600 ml-1">({parseResult.errors} warning{parseResult.errors !== 1 ? 's' : ''})</span>
                  )}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                onClick={handleClear}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Preview table */}
            <div className="max-h-80 overflow-y-auto rounded-md border text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-20">Level</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Title</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-24">Plan Start</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-24">Plan End</th>
                    <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-16">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-t ${row.error ? 'bg-amber-50' : 'hover:bg-muted/30'}`}
                    >
                      <td className="px-3 py-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-xs font-medium ${LEVEL_BADGE_CLASS[row.level]}`}
                        >
                          {LEVEL_LABELS[row.level]}
                        </Badge>
                      </td>
                      <td className={`px-3 py-1.5 ${LEVEL_INDENT[row.level]}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={row.level === 0 ? 'font-semibold' : ''}>{row.title}</span>
                          {row.error && (
                            <span title={row.error}>
                              <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">
                        {row.planStart ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">
                        {row.planEnd ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs">
                        {row.progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          {parseResult && (
            <Button
              size="sm"
              onClick={handleImport}
              disabled={bulkCreate.isPending || totalItems === 0}
            >
              {bulkCreate.isPending ? 'Importing…' : `Import ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
