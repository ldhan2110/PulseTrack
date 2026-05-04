import { useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateTestExecution } from '@/hooks/useTestExecutions';
import { useTestSuites } from '@/hooks/useTestSuites';
import { useTestCases } from '@/hooks/useTestCases';
import { useSprints } from '@/hooks/useSprints';
import type { Member, TestCase, TestSuite } from '@/lib/types';

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>;
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold leading-none">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface CreateExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: Member[];
}

type SourceMode = 'suite' | 'cherry-pick';

export function CreateExecutionDialog({
  open,
  onOpenChange,
  projectId,
  members,
}: CreateExecutionDialogProps) {
  const createExecution = useCreateTestExecution(projectId);
  const { data: suites = [] } = useTestSuites(projectId);
  const { data: testCases = [] } = useTestCases(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('suite');
  const [suiteId, setSuiteId] = useState('');
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [caseSearch, setCaseSearch] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [nameError, setNameError] = useState('');

  const caseList = (testCases ?? []) as TestCase[];
  const suiteList = (suites ?? []) as TestSuite[];

  const filteredCases = useMemo(() => {
    if (!caseSearch) return caseList;
    const q = caseSearch.toLowerCase();
    return caseList.filter(
      (tc) =>
        tc.title.toLowerCase().includes(q) ||
        (tc.testCaseKey?.toLowerCase().includes(q) ?? false),
    );
  }, [caseList, caseSearch]);

  const assigneeLabel = useMemo(() => {
    if (!assigneeId) return 'Select assignee';
    const member = members.find((m) => m.userId === assigneeId);
    return member?.user.name ?? member?.user.username ?? 'Select assignee';
  }, [assigneeId, members]);

  const toggleCase = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setName('');
    setAssigneeId('');
    setSprintId('');
    setSourceMode('suite');
    setSuiteId('');
    setSelectedCaseIds(new Set());
    setCaseSearch('');
    setNameError('');
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    if (!assigneeId) {
      return;
    }

    const payload: {
      name: string;
      assigneeId: string;
      sprintId?: string;
      suiteId?: string;
      testCaseIds?: string[];
    } = {
      name: name.trim(),
      assigneeId,
      sprintId: sprintId || undefined,
    };

    if (sourceMode === 'suite' && suiteId) {
      payload.suiteId = suiteId;
    } else if (sourceMode === 'cherry-pick' && selectedCaseIds.size > 0) {
      payload.testCaseIds = Array.from(selectedCaseIds);
    }

    createExecution.mutate(payload, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[50vw] max-w-none max-h-[85vh] overflow-y-auto" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>New Test Execution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="exec-name" required>Name</FieldLabel>
              <Input
                id="exec-name"
                placeholder="Execution name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                autoFocus
                aria-invalid={!!nameError}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </Field>

            <Field>
              <FieldLabel required>Assignee</FieldLabel>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={assigneeOpen}
                    className="h-8 justify-between font-normal"
                  >
                    <span className={cn('truncate text-sm', !assigneeId && 'text-muted-foreground')}>
                      {assigneeLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-0" align="start">
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
                                <AvatarImage src={member.user.imageUrl} alt={member.user.name ?? member.user.username} />
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
            </Field>

            <Field>
              <FieldLabel>Sprint</FieldLabel>
              <Select value={sprintId} onValueChange={(val) => setSprintId(val === 'NONE' ? '' : val)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="No sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No sprint</SelectItem>
                  {sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel required>Source</FieldLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={sourceMode === 'suite' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceMode('suite')}
                >
                  From Suite
                </Button>
                <Button
                  type="button"
                  variant={sourceMode === 'cherry-pick' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceMode('cherry-pick')}
                >
                  Cherry Pick
                </Button>
              </div>
            </Field>

            {sourceMode === 'suite' && (
              <Field>
                <FieldLabel>Suite</FieldLabel>
                <Select value={suiteId} onValueChange={setSuiteId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select a test suite" />
                  </SelectTrigger>
                  <SelectContent>
                    {suiteList.map((suite) => (
                      <SelectItem key={suite.id} value={suite.id}>
                        {suite.name}
                        {suite._count?.members != null && (
                          <span className="text-muted-foreground ml-1">
                            ({suite._count.members} cases)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {sourceMode === 'cherry-pick' && (
              <Field>
                <FieldLabel>Test Cases ({selectedCaseIds.size} selected)</FieldLabel>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search test cases..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto rounded-md border p-1.5 flex flex-col gap-0.5">
                  {filteredCases.map((tc) => (
                    <label
                      key={tc.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedCaseIds.has(tc.id)}
                        onCheckedChange={() => toggleCase(tc.id)}
                      />
                      {tc.testCaseKey && (
                        <span className="font-mono text-xs text-muted-foreground">{tc.testCaseKey}</span>
                      )}
                      <span className="truncate">{tc.title}</span>
                    </label>
                  ))}
                  {filteredCases.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No test cases found.
                    </p>
                  )}
                </div>
              </Field>
            )}
          </FieldGroup>
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
            <Button type="submit" disabled={createExecution.isPending}>
              {createExecution.isPending ? 'Creating...' : 'Create Execution'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
