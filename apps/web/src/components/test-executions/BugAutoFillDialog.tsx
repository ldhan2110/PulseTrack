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
import { Textarea } from '@/components/ui/textarea';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateBug } from '@/hooks/useBugs';
import type { BugSeverity, Member, TestExecutionCase, Priority } from '@/lib/types';

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

function mapPriorityToSeverity(priority: Priority | null | undefined): BugSeverity {
  switch (priority) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}

interface BugAutoFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  executionCase: TestExecutionCase;
  executionName: string;
  members: Member[];
}

export function BugAutoFillDialog({
  open,
  onOpenChange,
  projectId,
  executionCase,
  executionName,
  members,
}: BugAutoFillDialogProps) {
  const createBug = useCreateBug(projectId);
  const tc = executionCase.testCase;

  const defaultTitle = `[${tc.testCaseKey}] ${tc.title}`;
  const defaultDescription = `Failed during test execution "${executionName}"\nTest Case: ${tc.testCaseKey} — ${tc.title}`;
  const defaultSeverity = mapPriorityToSeverity(tc.priority);
  const defaultReproSteps = (tc.steps ?? []).map((step, i) => ({
    position: i + 1,
    content: step.action,
  }));
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [severity, setSeverity] = useState<BugSeverity>(defaultSeverity);
  const [actualResult, setActualResult] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const assigneeLabel = useMemo(() => {
    if (!assigneeId) return 'Unassigned';
    const member = members.find((m) => m.userId === assigneeId);
    return member?.user.name ?? member?.user.username ?? 'Unassigned';
  }, [assigneeId, members]);

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      // Reset form
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setSeverity(defaultSeverity);
      setActualResult('');
      setAssigneeId('');
    }
    onOpenChange(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createBug.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        expectedResult: tc.expectedResult ?? undefined,
        actualResult: actualResult.trim() || undefined,
        reproSteps: defaultReproSteps.length > 0 ? defaultReproSteps : undefined,
        assigneeId: assigneeId || undefined,
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
      <DialogContent className="w-[520px] max-w-full">
        <DialogHeader>
          <DialogTitle>Create Bug from Failed Test</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bug-af-title" required>Title</FieldLabel>
              <Input
                id="bug-af-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="bug-af-description">Description</FieldLabel>
              <Textarea
                id="bug-af-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel required>Severity</FieldLabel>
              <Select value={severity} onValueChange={(val) => setSeverity(val as BugSeverity)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Expected Result</FieldLabel>
              <Textarea
                value={tc.expectedResult ?? ''}
                readOnly
                rows={2}
                className="bg-muted"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="bug-af-actual">Actual Result</FieldLabel>
              <Textarea
                id="bug-af-actual"
                placeholder="Describe what actually happened..."
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                rows={2}
              />
            </Field>

            <Field>
              <FieldLabel>Assignee</FieldLabel>
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
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search members..." />
                    <CommandList>
                      <CommandEmpty>No members found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="unassigned"
                          onSelect={() => {
                            setAssigneeId('');
                            setAssigneeOpen(false);
                          }}
                        >
                          <Check
                            className={cn('mr-2 size-4', !assigneeId ? 'opacity-100' : 'opacity-0')}
                          />
                          <span className="text-muted-foreground">Unassigned</span>
                        </CommandItem>
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
          </FieldGroup>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createBug.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createBug.isPending}>
              {createBug.isPending ? 'Creating...' : 'Create Bug'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
