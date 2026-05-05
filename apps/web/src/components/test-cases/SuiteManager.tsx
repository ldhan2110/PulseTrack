import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTestSuite } from '@/hooks/useTestSuites';
import { useTestCases } from '@/hooks/useTestCases';
import { useTestModules } from '@/hooks/useTestModules';
import { X, Plus, ChevronRight, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { TestCase, TestModule, Priority, TestCaseStatus } from '@/lib/types';

interface SuiteManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  suiteId: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

type FilterPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const PRIORITY_CHIPS: { label: string; value: FilterPriority }[] = [
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const STATUS_CHIPS: { label: string; value: TestCaseStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Deprecated', value: 'DEPRECATED' },
];

const PRIORITY_DOT: Record<FilterPriority, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-green-500',
};

function PriorityDot({ priority }: { priority: Priority | null }) {
  if (!priority || !(priority in PRIORITY_DOT)) return null;
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full shrink-0',
        PRIORITY_DOT[priority as FilterPriority],
      )}
    />
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function SuiteManager({ open, onOpenChange, projectId, suiteId }: SuiteManagerProps) {
  const queryClient = useQueryClient();

  const { data: suite } = useTestSuite(projectId, suiteId);
  const { data: allCases = [] } = useTestCases(projectId);
  const { data: allModules = [] } = useTestModules(projectId);

  // quick-add combobox
  const [comboOpen, setComboOpen] = useState(false);

  // filter state
  const [filterModuleId, setFilterModuleId] = useState<string | null>(null);
  const [filterPriorities, setFilterPriorities] = useState<Set<FilterPriority>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<TestCaseStatus>>(new Set());
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false);

  // available list selection + expansion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['__ungrouped__']));

  // members section
  const memberCount = suite?.members?.length ?? 0;
  const [membersExpanded, setMembersExpanded] = useState(memberCount <= 5);

  // keep members section collapsed state in sync with first load
  const memberCaseIds = useMemo(
    () => new Set(suite?.members?.map((m) => m.testCase.id) ?? []),
    [suite?.members],
  );

  // module lookup map
  const moduleMap = useMemo(
    () => new Map<string, TestModule>(allModules.map((m) => [m.id, m])),
    [allModules],
  );

  // cases not yet in suite
  const nonMemberCases = useMemo(
    () => (allCases as TestCase[]).filter((tc) => !memberCaseIds.has(tc.id)),
    [allCases, memberCaseIds],
  );

  // apply filters to available list
  const filteredCases = useMemo(() => {
    return nonMemberCases.filter((tc) => {
      if (filterModuleId && tc.moduleId !== filterModuleId) return false;
      if (filterPriorities.size > 0 && !filterPriorities.has(tc.priority as FilterPriority))
        return false;
      if (filterStatuses.size > 0 && !filterStatuses.has(tc.status)) return false;
      return true;
    });
  }, [nonMemberCases, filterModuleId, filterPriorities, filterStatuses]);

  // group filtered cases by moduleId
  const groupedCases = useMemo(() => {
    const groups = new Map<string, TestCase[]>();
    for (const tc of filteredCases) {
      const key = tc.moduleId ?? '__ungrouped__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tc);
    }
    return groups;
  }, [filteredCases]);

  // seed expanded set when groups first appear
  useMemo(() => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      for (const key of groupedCases.keys()) next.add(key);
      return next;
    });
  }, [groupedCases]);

  const anyFilterActive =
    filterModuleId !== null || filterPriorities.size > 0 || filterStatuses.size > 0;

  // ── mutations ───────────────────────────────────────────────────────────────

  const addMembers = useMutation({
    mutationFn: (testCaseIds: string[]) => api.addSuiteMembers(projectId, suiteId, testCaseIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suite', projectId, suiteId] });
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      setSelectedIds(new Set());
      toast.success('Cases added to suite');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (testCaseId: string) => api.removeSuiteMember(projectId, suiteId, testCaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suite', projectId, suiteId] });
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Case removed from suite');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── interaction handlers ────────────────────────────────────────────────────

  const handleQuickAdd = (tc: TestCase) => {
    addMembers.mutate([tc.id]);
    // keep popover open for sequential adds — cmdk clears its own input
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupSelect = (moduleKey: string, cases: TestCase[]) => {
    const allSelected = cases.every((tc) => selectedIds.has(tc.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) cases.forEach((tc) => next.delete(tc.id));
      else cases.forEach((tc) => next.add(tc.id));
      return next;
    });
  };

  const toggleGroupExpand = (key: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePriority = (p: FilterPriority) => {
    setFilterPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleStatus = (s: TestCaseStatus) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterModuleId(null);
    setFilterPriorities(new Set());
    setFilterStatuses(new Set());
  };

  const handleAddSelected = () => {
    if (selectedIds.size === 0) return;
    addMembers.mutate(Array.from(selectedIds));
  };

  // ── render ──────────────────────────────────────────────────────────────────

  const selectedModuleName = filterModuleId ? (moduleMap.get(filterModuleId)?.name ?? 'Module') : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[56vw] max-w-none max-h-[85vh] flex flex-col"
        style={{ maxWidth: 'none' }}
      >
        <DialogHeader>
          <DialogTitle>Manage Suite{suite ? ` — ${suite.name}` : ''}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3 overflow-hidden">
          {/* ── 1. Quick-Add Combobox ─────────────────────────────────────── */}
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-full justify-between font-normal text-muted-foreground"
              >
                Quick add by name or key…
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name or key…" />
                <CommandList className="max-h-[260px]">
                  <CommandEmpty>No matching cases.</CommandEmpty>
                  {nonMemberCases.length > 0 && (
                    <CommandGroup>
                      {nonMemberCases.map((tc) => (
                        <CommandItem
                          key={tc.id}
                          value={`${tc.testCaseKey ?? ''} ${tc.title}`}
                          onSelect={() => handleQuickAdd(tc)}
                          className="gap-2"
                        >
                          {tc.testCaseKey && (
                            <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">
                              {tc.testCaseKey}
                            </span>
                          )}
                          <span className="flex-1 truncate text-sm">{tc.title}</span>
                          <PriorityDot priority={tc.priority} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* ── 2. Filter Bar ────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Module filter */}
            <Popover open={modulePopoverOpen} onOpenChange={setModulePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-1',
                    filterModuleId && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {selectedModuleName ?? 'Module'}
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-1" align="start">
                <div className="flex flex-col gap-0.5">
                  <button
                    className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                    onClick={() => { setFilterModuleId(null); setModulePopoverOpen(false); }}
                  >
                    All modules
                  </button>
                  {allModules.map((mod) => (
                    <button
                      key={mod.id}
                      className={cn(
                        'text-left text-sm px-2 py-1.5 rounded hover:bg-muted',
                        filterModuleId === mod.id && 'bg-muted font-medium',
                      )}
                      onClick={() => { setFilterModuleId(mod.id); setModulePopoverOpen(false); }}
                    >
                      {mod.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Priority chips */}
            {PRIORITY_CHIPS.map(({ label, value }) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => togglePriority(value)}
                className={cn(
                  filterPriorities.has(value) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {label}
              </Button>
            ))}

            {/* Status chips */}
            {STATUS_CHIPS.map(({ label, value }) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => toggleStatus(value)}
                className={cn(
                  filterStatuses.has(value) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {label}
              </Button>
            ))}

            {anyFilterActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                Clear
              </Button>
            )}
          </div>

          {/* ── 3. Available Cases List ──────────────────────────────────── */}
          <div className="flex flex-col gap-0 overflow-y-auto max-h-[50vh] rounded-md border">
            {groupedCases.size === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4">
                {anyFilterActive ? 'No cases match the current filters.' : 'All cases are already members of this suite.'}
              </p>
            )}

            {Array.from(groupedCases.entries()).map(([moduleKey, cases], groupIndex) => {
              const mod = moduleKey === '__ungrouped__' ? null : moduleMap.get(moduleKey);
              const groupLabel = mod?.name ?? 'Ungrouped';
              const isExpanded = expandedModules.has(moduleKey);
              const allGroupSelected = cases.every((tc) => selectedIds.has(tc.id));
              const someGroupSelected = cases.some((tc) => selectedIds.has(tc.id)) && !allGroupSelected;

              return (
                <div key={moduleKey} className={cn(groupIndex > 0 && 'border-t')}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 select-none">
                    <Checkbox
                      checked={someGroupSelected ? 'indeterminate' : allGroupSelected}
                      onCheckedChange={() => toggleGroupSelect(moduleKey, cases)}
                      aria-label={`Select all in ${groupLabel}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="flex items-center gap-1.5 flex-1 text-left"
                      onClick={() => toggleGroupExpand(moduleKey)}
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-90',
                        )}
                      />
                      <span className="text-[13px] font-medium">{groupLabel}</span>
                      <span className="text-[11px] text-muted-foreground">({cases.length})</span>
                    </button>
                  </div>

                  {/* Group cases */}
                  {isExpanded && (
                    <div className="flex flex-col">
                      {cases.map((tc) => (
                        <label
                          key={tc.id}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40 text-sm border-t border-border/40',
                            selectedIds.has(tc.id) && 'bg-muted/30',
                          )}
                        >
                          <Checkbox
                            checked={selectedIds.has(tc.id)}
                            onCheckedChange={() => toggleSelected(tc.id)}
                          />
                          {tc.testCaseKey && (
                            <span className="font-mono text-xs text-muted-foreground shrink-0 w-20 truncate">
                              {tc.testCaseKey}
                            </span>
                          )}
                          <span className="flex-1 truncate">{tc.title}</span>
                          <PriorityDot priority={tc.priority} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── 4. Sticky Add Button ─────────────────────────────────────── */}
          {selectedIds.size > 0 && (
            <div className="flex">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={handleAddSelected}
                disabled={addMembers.isPending}
              >
                <Plus className="size-3.5" />
                Add {selectedIds.size} case{selectedIds.size > 1 ? 's' : ''}
              </Button>
            </div>
          )}

          <Separator />

          {/* ── 5. Current Members ───────────────────────────────────────── */}
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center gap-1.5 text-left"
              onClick={() => setMembersExpanded((v) => !v)}
            >
              <ChevronRight
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform',
                  membersExpanded && 'rotate-90',
                )}
              />
              <span className="text-[13px] font-semibold">Members ({memberCount})</span>
            </button>

            {membersExpanded && (
              <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto mt-1">
                {memberCount === 0 && (
                  <p className="text-sm text-muted-foreground py-1 px-2">No test cases in this suite.</p>
                )}
                {suite?.members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 text-sm"
                  >
                    {member.testCase.testCaseKey && (
                      <span className="font-mono text-xs text-muted-foreground shrink-0 w-20 truncate">
                        {member.testCase.testCaseKey}
                      </span>
                    )}
                    <span className="flex-1 truncate">{member.testCase.title}</span>
                    <PriorityDot priority={member.testCase.priority ?? null} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeMember.mutate(member.testCase.id)}
                      disabled={removeMember.isPending}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
