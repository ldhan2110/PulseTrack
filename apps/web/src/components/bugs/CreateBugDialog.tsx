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
import { RichTextEditor } from '@/components/tasks/RichTextEditor';
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
import { ReproStepsList } from '@/components/bugs/ReproStepsList';
import type { BugSeverity, Member } from '@/lib/types';
import { useAuth } from '@/auth/useAuth';

// FieldGroup + Field composition per shadcn skill rules
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
  const [reproSteps, setReproSteps] = useState<{ position: number; content: string }[]>([]);
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [environment, setEnvironment] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const assigneeLabel = useMemo(() => {
    if (!assigneeId) return 'Unassigned';
    const member = members.find((m) => m.userId === assigneeId);
    return member?.user.name ?? member?.user.username ?? 'Unassigned';
  }, [assigneeId, members]);

  const ownerLabel = useMemo(() => {
    if (!ownerId) return 'No owner';
    const member = members.find((m) => m.userId === ownerId);
    return member?.user.name ?? member?.user.username ?? 'No owner';
  }, [ownerId, members]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSeverity('');
    setReproSteps([]);
    setExpectedResult('');
    setActualResult('');
    setEnvironment('');
    setAssigneeId('');
    setOwnerId('');
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
        expectedResult: expectedResult.trim() || undefined,
        actualResult: actualResult.trim() || undefined,
        environment: environment.trim() || undefined,
        assigneeId: assigneeId || undefined,
        ownerId: ownerId || undefined,
        reproSteps: reproSteps.length > 0 ? reproSteps : undefined,
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
      <DialogContent className="w-[50vw] max-h-[90vh]" style={{ maxWidth: "none" }}>
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
              <FieldLabel>Description</FieldLabel>
              <RichTextEditor
                initialContent={description}
                onSave={() => {}}
                editable={true}
                alwaysEditing={true}
                placeholder="Describe the bug (optional)"
                onChange={(html) => setDescription(html)}
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
              <FieldLabel>Reproduction Steps</FieldLabel>
              <ReproStepsList
                steps={reproSteps}
                onChange={setReproSteps}
              />
            </Field>

            <div className="flex gap-4">
              <Field className="flex-1">
                <FieldLabel htmlFor="bug-expected">Expected Result</FieldLabel>
                <Textarea
                  id="bug-expected"
                  placeholder="What should happen..."
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  rows={2}
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="bug-actual">Actual Result</FieldLabel>
                <Textarea
                  id="bug-actual"
                  placeholder="What actually happened..."
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                  rows={2}
                />
              </Field>
            </div>

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
                    <CommandList className="max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
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
                              {member.user.imageUrl && <AvatarImage src={member.user.imageUrl} alt={member.user.name ?? member.user.username} />}
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
              <FieldLabel>Bug Owner</FieldLabel>
              <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={ownerOpen}
                    className="h-8 justify-between font-normal"
                  >
                    <span className={cn('truncate text-sm', !ownerId && 'text-muted-foreground')}>
                      {ownerLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search members..." />
                    <CommandList className="max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                      <CommandEmpty>No members found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="no-owner"
                          onSelect={() => {
                            setOwnerId('');
                            setOwnerOpen(false);
                          }}
                        >
                          <Check
                            className={cn('mr-2 size-4', !ownerId ? 'opacity-100' : 'opacity-0')}
                          />
                          <span className="text-muted-foreground">No owner</span>
                        </CommandItem>
                        {members.map((member) => (
                          <CommandItem
                            key={member.userId}
                            value={member.user.name ?? member.user.username}
                            onSelect={() => {
                              setOwnerId(member.userId);
                              setOwnerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 size-4',
                                ownerId === member.userId ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <Avatar className="size-5 mr-1.5">
                              {member.user.imageUrl && <AvatarImage src={member.user.imageUrl} alt={member.user.name ?? member.user.username} />}
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

            {/* Reporter: auto-filled from current user, read-only */}
            {user && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-[13px] font-semibold text-foreground">Reporter:</span>
                <Avatar className="size-5">
                  {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name ?? user.username ?? 'User'} />}
                  <AvatarFallback className="text-[9px]">{getInitials(user.name ?? user.username ?? user.email ?? 'U')}</AvatarFallback>
                </Avatar>
                <span>{user.name ?? user.username ?? user.email}</span>
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
