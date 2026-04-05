import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateBug } from '@/hooks/useBugs';
import type { BugSeverity, Member } from '@/lib/types';
import { useAuth } from '@/auth/useAuth';

// FieldGroup + Field composition per shadcn skill rules
function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
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

interface CreateBugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: Member[];
}

interface FormErrors {
  title?: string;
  severity?: string;
}

export function CreateBugDialog({
  open,
  onOpenChange,
  projectId,
  members,
}: CreateBugDialogProps) {
  const createBug = useCreateBug(projectId);
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity | ''>('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [environment, setEnvironment] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const assigneeLabel = useMemo(() => {
    if (!assigneeId) return 'Unassigned';
    const member = members.find((m) => m.userId === assigneeId);
    return member?.user.name ?? 'Unassigned';
  }, [assigneeId, members]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSeverity('');
    setStepsToReproduce('');
    setEnvironment('');
    setAssigneeId('');
    setErrors({});
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!severity) {
      newErrors.severity = 'Severity is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !severity) return;

    createBug.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        stepsToReproduce: stepsToReproduce.trim() || undefined,
        environment: environment.trim() || undefined,
        assigneeId: assigneeId || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[520px] max-w-full">
        <DialogHeader>
          <DialogTitle>Report Bug</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bug-title" required>Title</FieldLabel>
              <Input
                id="bug-title"
                placeholder="Bug title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="bug-description">Description</FieldLabel>
              <Textarea
                id="bug-description"
                placeholder="Describe the bug (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </Field>

            <Field>
              <FieldLabel required>Severity</FieldLabel>
              <Select value={severity} onValueChange={(val) => setSeverity(val as BugSeverity)}>
                <SelectTrigger className="h-8" aria-invalid={!!errors.severity}>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              {errors.severity && (
                <p className="text-xs text-destructive">{errors.severity}</p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="bug-steps">Reproduction Steps</FieldLabel>
              <Textarea
                id="bug-steps"
                placeholder="Steps to reproduce..."
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="bug-environment">Environment</FieldLabel>
              <Input
                id="bug-environment"
                placeholder="e.g., Chrome 120, Windows 11"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
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
                            value={member.user.name}
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
                              <AvatarFallback className="text-[9px]">
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            {member.user.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            {/* Reporter: auto-filled from current user, read-only */}
            {user && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-[13px] font-semibold text-foreground">Reporter:</span>
                <Avatar className="size-5">
                  <AvatarFallback className="text-[9px]">{getInitials(user.username ?? user.email ?? 'U')}</AvatarFallback>
                </Avatar>
                <span>{user.username ?? user.email}</span>
              </div>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createBug.isPending}
            >
              Discard
            </Button>
            <Button type="submit" disabled={createBug.isPending}>
              {createBug.isPending ? 'Reporting...' : 'Report Bug'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
