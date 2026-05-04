import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useMembers } from '@/hooks/useMembers';
import { toast } from 'sonner';
import type { BugSeverity } from '@/lib/types';

const SEVERITY_OPTIONS: { value: BugSeverity; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

interface ExportBugsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ExportBugsDialog({ open, onOpenChange, projectId }: ExportBugsDialogProps) {
  const { data: workflow } = useWorkflow(projectId, 'BUG');
  const { data: members = [] } = useMembers(projectId);

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
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
    selectedStatuses.length > 0 || selectedSeverities.length > 0 ||
    selectedAssignees.length > 0 || selectedReporters.length > 0 ||
    search !== '';

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (selectedStatuses.length) p.workflowStatusId = selectedStatuses.join(',');
    if (selectedSeverities.length) p.severity = selectedSeverities.join(',');
    if (selectedAssignees.length) p.assigneeId = selectedAssignees.join(',');
    if (selectedReporters.length) p.reporterId = selectedReporters.join(',');
    if (search) p.search = search;
    return p;
  };

  const handleExport = async (useFilters: boolean) => {
    setExporting(true);
    try {
      await api.exportBugs(projectId, useFilters ? buildParams() : undefined);
      toast.success('Bugs exported');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSelectedStatuses([]);
    setSelectedSeverities([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetFilters(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg w-150 max-h-[75vh]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>Export Bugs to Excel</DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Search */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Status */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedStatuses, (workflow?.statuses ?? []).map((ws) => ws.id), setSelectedStatuses)}>
                {selectedStatuses.length === (workflow?.statuses ?? []).length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {(workflow?.statuses ?? []).map((ws) => (
                <label key={ws.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedStatuses.includes(ws.id)}
                    onCheckedChange={() => toggle(selectedStatuses, ws.id, setSelectedStatuses)}
                  />
                  <span className="size-2 rounded-full" style={{ backgroundColor: ws.color }} />
                  {ws.name}
                </label>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Severity</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedSeverities, SEVERITY_OPTIONS.map((o) => o.value), setSelectedSeverities)}>
                {selectedSeverities.length === SEVERITY_OPTIONS.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {SEVERITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedSeverities.includes(opt.value)}
                    onCheckedChange={() => toggle(selectedSeverities, opt.value, setSelectedSeverities)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedAssignees, members.map((m) => m.userId), setSelectedAssignees)}>
                {selectedAssignees.length === members.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedAssignees.includes(m.userId)}
                    onCheckedChange={() => toggle(selectedAssignees, m.userId, setSelectedAssignees)}
                  />
                  <Avatar className="size-5">
                    {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? m.user.username} />}
                    <AvatarFallback className="text-[9px]">
                      {(m.user.name ?? m.user.username ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.user.name ?? m.user.username}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Reporter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Reporter</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedReporters, members.map((m) => m.userId), setSelectedReporters)}>
                {selectedReporters.length === members.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedReporters.includes(m.userId)}
                    onCheckedChange={() => toggle(selectedReporters, m.userId, setSelectedReporters)}
                  />
                  <Avatar className="size-5">
                    {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? m.user.username} />}
                    <AvatarFallback className="text-[9px]">
                      {(m.user.name ?? m.user.username ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.user.name ?? m.user.username}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        </DialogBody>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleExport(false)} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
            Export All
          </Button>
          <Button onClick={() => handleExport(true)} disabled={exporting || !hasFilters}>
            {exporting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Download className="size-4 mr-1" />}
            Export Filtered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
