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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useMembers } from '@/hooks/useMembers';
import { useSprints } from '@/hooks/useSprints';
import { toast } from 'sonner';
import type { Priority } from '@/lib/types';

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'BLOCKER', label: 'Blocker' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

interface ExportTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ExportTasksDialog({ open, onOpenChange, projectId }: ExportTasksDialogProps) {
  const { data: workflow } = useWorkflow(projectId, 'TASK');
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [plannedStartFrom, setPlannedStartFrom] = useState<Date | undefined>();
  const [plannedStartTo, setPlannedStartTo] = useState<Date | undefined>();
  const [plannedEndFrom, setPlannedEndFrom] = useState<Date | undefined>();
  const [plannedEndTo, setPlannedEndTo] = useState<Date | undefined>();
  const [overdue, setOverdue] = useState(false);
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
    selectedStatuses.length > 0 || selectedAssignees.length > 0 ||
    selectedSprints.length > 0 || selectedPriorities.length > 0 ||
    !!plannedStartFrom || !!plannedStartTo ||
    !!plannedEndFrom || !!plannedEndTo ||
    overdue || search !== '';

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    if (selectedStatuses.length) p.workflowStatusId = selectedStatuses.join(',');
    if (selectedAssignees.length) p.assigneeId = selectedAssignees.join(',');
    if (selectedSprints.length) p.sprintId = selectedSprints.join(',');
    if (selectedPriorities.length) p.priority = selectedPriorities.join(',');
    if (plannedStartFrom) p.plannedStartFrom = plannedStartFrom.toISOString();
    if (plannedStartTo) p.plannedStartTo = plannedStartTo.toISOString();
    if (plannedEndFrom) p.plannedEndFrom = plannedEndFrom.toISOString();
    if (plannedEndTo) p.plannedEndTo = plannedEndTo.toISOString();
    if (overdue) p.overdue = 'true';
    if (search) p.search = search;
    return p;
  };

  const handleExport = async (useFilters: boolean) => {
    setExporting(true);
    try {
      await api.exportTasks(projectId, useFilters ? buildParams() : undefined);
      toast.success('Tasks exported');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSelectedStatuses([]);
    setSelectedAssignees([]);
    setSelectedSprints([]);
    setSelectedPriorities([]);
    setPlannedStartFrom(undefined);
    setPlannedStartTo(undefined);
    setPlannedEndFrom(undefined);
    setPlannedEndTo(undefined);
    setOverdue(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetFilters(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg w-120 h-[75vh]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>Export Tasks to Excel</DialogTitle>
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

          {/* Priority */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedPriorities, PRIORITY_OPTIONS.map((o) => o.value), setSelectedPriorities)}>
                {selectedPriorities.length === PRIORITY_OPTIONS.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedPriorities.includes(opt.value)}
                    onCheckedChange={() => toggle(selectedPriorities, opt.value, setSelectedPriorities)}
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

          {/* Sprint */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Sprint</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleAll(selectedSprints, sprints.map((s) => s.id), setSelectedSprints)}>
                {selectedSprints.length === sprints.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {sprints.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedSprints.includes(s.id)}
                    onCheckedChange={() => toggle(selectedSprints, s.id, setSelectedSprints)}
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Planned Start Date Range */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Planned Start</Label>
            <div className="flex flex-col gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedStartFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedStartFrom ? format(plannedStartFrom, 'PP') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedStartFrom} onSelect={setPlannedStartFrom} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedStartTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedStartTo ? format(plannedStartTo, 'PP') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedStartTo} onSelect={setPlannedStartTo} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Planned End Date Range */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Planned End</Label>
            <div className="flex flex-col gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedEndFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedEndFrom ? format(plannedEndFrom, 'PP') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedEndFrom} onSelect={setPlannedEndFrom} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 justify-start text-left font-normal text-xs', !plannedEndTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1 size-3" />
                    {plannedEndTo ? format(plannedEndTo, 'PP') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedEndTo} onSelect={setPlannedEndTo} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Overdue */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={overdue} onCheckedChange={(c) => setOverdue(!!c)} />
              Only overdue tasks
            </label>
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
