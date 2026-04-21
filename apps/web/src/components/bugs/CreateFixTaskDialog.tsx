import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Task, User } from '@/lib/types';

interface CreateFixTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  defaultAssigneeId: string | null;
  tasks: Task[];
  members: User[];
  onSubmit: (data: { title: string; parentId?: string; assigneeId?: string }) => void;
  isLoading?: boolean;
}

export function CreateFixTaskDialog({
  open,
  onOpenChange,
  defaultTitle,
  defaultAssigneeId,
  tasks,
  members,
  onSubmit,
  isLoading,
}: CreateFixTaskDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(defaultAssigneeId ?? undefined);
  const [parentOpen, setParentOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Only show top-level tasks (no parentId) as potential parents
  const topLevelTasks = tasks.filter((t) => !t.parentId);
  const selectedParent = topLevelTasks.find((t) => t.id === parentId);
  const selectedAssignee = members.find((m) => m.id === assigneeId);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      parentId,
      assigneeId,
    });
  };

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTitle(defaultTitle);
      setParentId(undefined);
      setAssigneeId(defaultAssigneeId ?? undefined);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Fix Task</DialogTitle>
          <DialogDescription>
            Create a task to fix this bug. The bug details will be included in the task description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="fix-task-title">Title</Label>
            <Input
              id="fix-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          {/* Parent Task (optional) */}
          <div className="space-y-2">
            <Label>Parent Task (optional)</Label>
            <Popover open={parentOpen} onOpenChange={setParentOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate text-sm">
                    {selectedParent
                      ? `${selectedParent.taskKey} — ${selectedParent.title}`
                      : 'Select parent task...'}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tasks..." />
                  <CommandList className="max-h-48 overflow-y-auto">
                    <CommandEmpty>No tasks found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setParentId(undefined);
                          setParentOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 size-4', !parentId ? 'opacity-100' : 'opacity-0')} />
                        <span className="text-sm text-muted-foreground">No parent (top-level task)</span>
                      </CommandItem>
                      {topLevelTasks.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.taskKey ?? t.title}
                          onSelect={() => {
                            setParentId(t.id);
                            setParentOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 size-4', parentId === t.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate text-sm">
                            {t.taskKey && <span className="text-muted-foreground mr-1">{t.taskKey}</span>}
                            {t.title}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate text-sm">
                    {selectedAssignee
                      ? selectedAssignee.name ?? selectedAssignee.username
                      : 'Select assignee...'}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search members..." />
                  <CommandList className="max-h-48 overflow-y-auto">
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {members.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.name ?? m.username ?? m.email}
                          onSelect={() => {
                            setAssigneeId(m.id);
                            setAssigneeOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 size-4', assigneeId === m.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="text-sm">{m.name ?? m.username}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isLoading}>
            {isLoading ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
