import { useMemo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronsUpDown, Zap, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTestCases } from '@/hooks/useTestCases';
import { useTestSuites } from '@/hooks/useTestSuites';
import { useSprints } from '@/hooks/useSprints';
import { useCreateTestExecution } from '@/hooks/useTestExecutions';
import type { Member, Sprint, TestCase, TestSuite } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface CreateExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: Member[];
}

export function CreateExecutionDialog({
  open,
  onOpenChange,
  projectId,
  members,
}: CreateExecutionDialogProps) {
  const createExecution = useCreateTestExecution(projectId);
  const { data: allCases = [] } = useTestCases(projectId);
  const { data: suites = [] } = useTestSuites(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [sourceTab, setSourceTab] = useState<'suite' | 'pick'>('pick');
  const [caseSearch, setCaseSearch] = useState('');
  const [autoRun, setAutoRun] = useState(false);

  const handleSuiteChange = useCallback(
    (suiteId: string) => {
      setSelectedSuiteId(suiteId);
      if (!suiteId) {
        setSelectedCaseIds(new Set());
        return;
      }
      const suite = suites.find((s: TestSuite) => s.id === suiteId);
      if (suite?.members) {
        setSelectedCaseIds(new Set(suite.members.map((m) => m.testCase.id)));
      }
    },
    [suites],
  );

  const toggleCase = useCallback((caseId: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }, []);

  const filteredCases = useMemo(() => {
    if (!caseSearch) return allCases;
    const q = caseSearch.toLowerCase();
    return allCases.filter(
      (c: TestCase) =>
        c.title.toLowerCase().includes(q) ||
        (c.testCaseKey && c.testCaseKey.toLowerCase().includes(q)),
    );
  }, [allCases, caseSearch]);

  const selectAllCases = useCallback(() => {
    setSelectedCaseIds(new Set(filteredCases.map((c: TestCase) => c.id)));
  }, [filteredCases]);

  const deselectAllCases = useCallback(() => {
    setSelectedCaseIds(new Set());
  }, []);

  const selectedCount = selectedCaseIds.size;

  const assigneeLabel = useMemo(() => {
    if (!assigneeId) return 'Select assignee';
    const member = members.find((m) => m.userId === assigneeId);
    return member?.user.name ?? member?.user.username ?? 'Select assignee';
  }, [assigneeId, members]);

  const resetForm = () => {
    setName('');
    setAssigneeId('');
    setSprintId('');
    setSelectedCaseIds(new Set());
    setSelectedSuiteId('');
    setSourceTab('pick');
    setCaseSearch('');
    setAutoRun(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !assigneeId || selectedCaseIds.size === 0) return;

    createExecution.mutate(
      {
        name: name.trim(),
        assigneeId,
        sprintId: sprintId || undefined,
        testCaseIds: Array.from(selectedCaseIds),
        suiteId: sourceTab === 'suite' && selectedSuiteId ? selectedSuiteId : undefined,
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[600px] max-w-full max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Test Execution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody className="flex flex-col gap-4 overflow-y-auto">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="exec-name" className="text-[13px] font-semibold">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="exec-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sprint 12 Regression"
                autoFocus
              />
            </div>

            {/* Assignee */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold">
                Assignee <span className="text-destructive">*</span>
              </label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="h-8 justify-between font-normal"
                  >
                    <span className={cn('truncate text-sm', !assigneeId && 'text-muted-foreground')}>
                      {assigneeLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search members..." />
                    <CommandList>
                      <CommandEmpty>No members found.</CommandEmpty>
                      <CommandGroup>
                        {members.map((member) => (
                          <CommandItem
                            key={member.userId}
                            value={member.user.name ?? member.user.username}
                            onSelect={() => {
                              setAssigneeId(member.userId);
                              setAssigneeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 size-4',
                                assigneeId === member.userId ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <Avatar className="size-5 mr-1.5">
                              {member.user.imageUrl && (
                                <AvatarImage src={member.user.imageUrl} />
                              )}
                              <AvatarFallback className="text-[9px]">
                                {getInitials(member.user.name ?? member.user.username)}
                              </AvatarFallback>
                            </Avatar>
                            {member.user.name ?? member.user.username}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sprint */}
            {(sprints as Sprint[]).length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold">Sprint</label>
                <Select value={sprintId || 'none'} onValueChange={(v) => setSprintId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="No sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sprint</SelectItem>
                    {(sprints as Sprint[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Source tabs */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold">
                Test Cases <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-1 bg-muted rounded-md p-0.5 w-fit">
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    sourceTab === 'pick'
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setSourceTab('pick')}
                >
                  Cherry-pick
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    sourceTab === 'suite'
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setSourceTab('suite')}
                >
                  From Suite
                </button>
              </div>

              {sourceTab === 'suite' && (
                <Select value={selectedSuiteId || 'none'} onValueChange={(v) => handleSuiteChange(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select suite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a suite...</SelectItem>
                    {(suites as TestSuite[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s._count?.members != null && `(${s._count.members} cases)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search cases..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectedCount === filteredCases.length ? deselectAllCases : selectAllCases}
                >
                  {selectedCount === filteredCases.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>

              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                {filteredCases.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No test cases found
                  </div>
                ) : (
                  filteredCases.map((tc: TestCase) => (
                    <label
                      key={tc.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    >
                      <Checkbox
                        checked={selectedCaseIds.has(tc.id)}
                        onCheckedChange={() => toggleCase(tc.id)}
                      />
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {tc.testCaseKey}
                      </span>
                      <span className="text-xs truncate flex-1">{tc.title}</span>
                      {tc.priority && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {tc.priority}
                        </Badge>
                      )}
                    </label>
                  ))
                )}
              </div>

              {selectedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCount} case{selectedCount !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Auto-run toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={autoRun}
                onCheckedChange={(v) => setAutoRun(!!v)}
              />
              <Zap className="size-3.5 text-yellow-500" />
              <span className="text-sm">Auto-run automated cases on start</span>
            </label>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createExecution.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createExecution.isPending || !name.trim() || !assigneeId || selectedCaseIds.size === 0
              }
            >
              {createExecution.isPending ? 'Creating...' : 'Create Execution'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
