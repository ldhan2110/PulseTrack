import { useState, useMemo } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateTask } from '@/hooks/useTasks';
import type { Member, Sprint, Priority } from '@/lib/types';

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

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW',      label: 'Low',      color: '#6b7280' },
  { value: 'MEDIUM',   label: 'Medium',   color: '#3b82f6' },
  { value: 'HIGH',     label: 'High',     color: '#f59e0b' },
  { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  { value: 'BLOCKER',  label: 'Blocker',  color: '#7c3aed' },
];

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: Member[];
  sprints: Sprint[];
}

interface FormErrors {
  title?: string;
  storyPoints?: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  members,
  sprints,
}: CreateTaskDialogProps) {
  const createTask = useCreateTask(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [storyPoints, setStoryPoints] = useState('');
  const [sprintId, setSprintId] = useState<string>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const selectedMember = useMemo(() => {
    if (!assigneeId || assigneeId === 'unassigned') return null;
    return members.find((m) => m.userId === assigneeId) ?? null;
  }, [assigneeId, members]);

  const assigneeLabel = selectedMember?.user.name ?? selectedMember?.user.username ?? 'Unassigned';

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setStoryPoints('');
    setSprintId('');
    setPriority('');
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
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    if (storyPoints !== '') {
      const pts = Number(storyPoints);
      if (isNaN(pts) || pts < 1 || pts > 100) {
        newErrors.storyPoints = 'Story points must be between 1 and 100';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    createTask.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId && assigneeId !== 'unassigned' ? assigneeId : undefined,
        storyPoints: storyPoints !== '' ? Number(storyPoints) : undefined,
        sprintId: sprintId && sprintId !== 'none' ? sprintId : undefined,
        priority: priority || undefined,
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
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="task-title" required>Title</FieldLabel>
              <Input
                id="task-title"
                placeholder="Task title"
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
              <FieldLabel htmlFor="task-description">Description</FieldLabel>
              <Textarea
                id="task-description"
                placeholder="Add a description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="task-points">Story Points</FieldLabel>
              <Input
                id="task-points"
                type="number"
                min={1}
                max={100}
                placeholder="—"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                aria-invalid={!!errors.storyPoints}
              />
              {errors.storyPoints && (
                <p className="text-xs text-destructive">{errors.storyPoints}</p>
              )}
            </Field>

            <Field>
              <FieldLabel>Priority</FieldLabel>
              <Select value={priority || 'none'} onValueChange={(val) => setPriority(val === 'none' ? '' : val as Priority)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span style={{ color: opt.color }}>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
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
                      {selectedMember ? (
                        <span className="flex items-center gap-2 truncate text-sm">
                          <Avatar className="size-5 shrink-0">
                            {selectedMember.user.imageUrl && <AvatarImage src={selectedMember.user.imageUrl} alt={assigneeLabel} />}
                            <AvatarFallback className="text-[9px]">{getInitials(assigneeLabel)}</AvatarFallback>
                          </Avatar>
                          {assigneeLabel}
                        </span>
                      ) : (
                        <span className="truncate text-sm text-muted-foreground">Unassigned</span>
                      )}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-50 p-0" align="start">
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
                              className={cn(
                                'mr-2 size-4',
                                !assigneeId ? 'opacity-100' : 'opacity-0',
                              )}
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
                                  'size-4',
                                  assigneeId === member.userId ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <Avatar className="size-5">
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
                <FieldLabel>Sprint</FieldLabel>
                <Select value={sprintId || 'none'} onValueChange={setSprintId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="None (backlog)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (backlog)</SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createTask.isPending}
            >
              Discard
            </Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
