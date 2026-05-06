import { useState } from 'react';
import { Download, Loader2, Search, FolderOpen, ListFilter, Signal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTestModules } from '@/hooks/useTestModules';
import { exportTestCasesToExcel } from '@/lib/exportTestCases';
import type { TestCase, TestCaseStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TestCaseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DEPRECATED', label: 'Deprecated' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'BLOCKER', label: 'Blocker' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

interface ExportTestCasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectPrefix?: string;
}

export function ExportTestCasesDialog({ open, onOpenChange, projectId, projectPrefix }: ExportTestCasesDialogProps) {
  const { data: modules = [] } = useTestModules(projectId);

  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    const idx = arr.indexOf(val);
    if (idx >= 0) setter(arr.filter((_, i) => i !== idx));
    else setter([...arr, val]);
  };

  const toggleAll = (selected: string[], allValues: string[], setter: (v: string[]) => void) => {
    setter(selected.length === allValues.length ? [] : allValues);
  };

  const hasFilters =
    selectedModules.length > 0 || selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 || search !== '';

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (selectedModules.length) p.moduleId = selectedModules.join(',');
    if (selectedStatuses.length) p.status = selectedStatuses.join(',');
    if (selectedPriorities.length) p.priority = selectedPriorities.join(',');
    if (search) p.search = search;
    return p;
  };

  const filename = `test-cases-${projectPrefix ?? 'export'}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  const handleExport = async (useFilters: boolean) => {
    setExporting(true);
    try {
      const cases = await (api as any).getTestCases?.(projectId, useFilters ? buildParams() : undefined) as TestCase[];
      exportTestCasesToExcel(cases, filename);
      toast.success('Test cases exported');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSelectedModules([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSearch('');
  };

  // Flatten modules for display (top-level only for simplicity)
  const flatModules = modules.filter((m) => !m.parentId);

  const activeFilterCount =
    (selectedModules.length > 0 ? 1 : 0) +
    (selectedStatuses.length > 0 ? 1 : 0) +
    (selectedPriorities.length > 0 ? 1 : 0) +
    (search !== '' ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetFilters(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg w-120 max-h-[75vh]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>Export Test Cases to Excel</DialogTitle>
          <DialogDescription>
            Choose filters to narrow the export, or export all test cases at once.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Search section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Search</Label>
            </div>
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Module section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Module</Label>
                {selectedModules.length > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium">
                    {selectedModules.length}
                  </span>
                )}
              </div>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedModules, flatModules.map((m) => m.id), setSelectedModules)}>
                {selectedModules.length === flatModules.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto rounded-md border p-2">
              {flatModules.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No modules found</span>
              )}
              {flatModules.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1">
                  <Checkbox
                    checked={selectedModules.includes(m.id)}
                    onCheckedChange={() => toggle(selectedModules, m.id, setSelectedModules)}
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Status & Priority side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ListFilter className="size-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</Label>
                  {selectedStatuses.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium">
                      {selectedStatuses.length}
                    </span>
                  )}
                </div>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedStatuses, STATUS_OPTIONS.map((o) => o.value), setSelectedStatuses)}>
                  {selectedStatuses.length === STATUS_OPTIONS.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 rounded-md border p-2">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1">
                    <Checkbox
                      checked={selectedStatuses.includes(opt.value)}
                      onCheckedChange={() => toggle(selectedStatuses, opt.value, setSelectedStatuses)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Signal className="size-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Priority</Label>
                  {selectedPriorities.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium">
                      {selectedPriorities.length}
                    </span>
                  )}
                </div>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedPriorities, PRIORITY_OPTIONS.map((o) => o.value), setSelectedPriorities)}>
                  {selectedPriorities.length === PRIORITY_OPTIONS.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 rounded-md border p-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1">
                    <Checkbox
                      checked={selectedPriorities.includes(opt.value)}
                      onCheckedChange={() => toggle(selectedPriorities, opt.value, setSelectedPriorities)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator />
        </DialogBody>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground self-center">
            {hasFilters
              ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
              : 'No filters applied'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport(false)} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
              Export All
            </Button>
            <Button onClick={() => handleExport(true)} disabled={exporting || !hasFilters}>
              {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
              Export Filtered
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
