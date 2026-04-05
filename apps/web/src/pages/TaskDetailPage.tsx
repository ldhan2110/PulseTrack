import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/tasks/StatusBadge';
import { useTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useMembers } from '@/hooks/useMembers';
import { useSprints } from '@/hooks/useSprints';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useProject } from '@/hooks/useProjects';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import type { TaskStatus, AcceptanceCriteria, SubTask } from '@/lib/types';
import { cn } from '@/lib/utils';

// FieldGroup + Field composition per shadcn skill rules
function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>;
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>;
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold text-muted-foreground leading-none">
      {children}
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

function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function TaskDetailPage() {
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: task, isLoading, isError } = useTask(projectId, taskId);
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { canManage, canEdit } = useProjectRole(projectId);
  const { data: project } = useProject(projectId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Description auto-save
  const [descValue, setDescValue] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const descSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sub-task add form
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

  // Acceptance criteria add
  const [addingCriteria, setAddingCriteria] = useState(false);
  const [newCriteriaText, setNewCriteriaText] = useState('');

  // Sync task data to local state when loaded
  useEffect(() => {
    if (task) {
      setDescValue(task.description ?? '');
    }
  }, [task?.id]); // Only reset when task changes, not on every update

  // Sub-task mutations
  const createSubTask = useMutation({
    mutationFn: (title: string) => api.createSubTask(projectId, taskId, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      setNewSubTaskTitle('');
      setAddingSubTask(false);
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  const updateSubTask = useMutation({
    mutationFn: ({
      subTaskId,
      data,
    }: {
      subTaskId: string;
      data: { status?: TaskStatus; assigneeId?: string | null; title?: string };
    }) => api.updateSubTask(projectId, taskId, subTaskId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  const deleteSubTask = useMutation({
    mutationFn: (subTaskId: string) => api.deleteSubTask(projectId, taskId, subTaskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  // Acceptance criteria mutations — use a dedicated endpoint
  // API stores acceptanceCriteria as array, we manage add/update/delete via task update
  // using the task-level updateTask mutation with the full criteria array
  const addCriteria = useCallback(() => {
    if (!newCriteriaText.trim() || !task) return;
    const existing = task.acceptanceCriteria ?? [];
    // We use a client-side call to a dedicated AC endpoint (via api.createSubTask pattern)
    // Since the API has subtask endpoints but the AcceptanceCriteria is managed separately,
    // we POST to the criteria endpoint
    void fetch(`/api/projects/${projectId}/tasks/${taskId}/acceptance-criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text: newCriteriaText.trim() }),
    }).then((res) => {
      if (res.ok) {
        void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
        setNewCriteriaText('');
        setAddingCriteria(false);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }, [newCriteriaText, projectId, taskId, queryClient, task]);

  const toggleCriteria = useCallback(
    (ac: AcceptanceCriteria) => {
      void fetch(`/api/projects/${projectId}/tasks/${taskId}/acceptance-criteria/${ac.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed: !ac.completed }),
      }).then((res) => {
        if (res.ok) {
          void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
        }
      });
    },
    [projectId, taskId, queryClient],
  );

  const deleteCriteria = useCallback(
    (acId: string) => {
      void fetch(`/api/projects/${projectId}/tasks/${taskId}/acceptance-criteria/${acId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then((res) => {
        if (res.ok) {
          void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
        }
      });
    },
    [projectId, taskId, queryClient],
  );

  const updateCriteriaText = useCallback(
    (acId: string, text: string) => {
      void fetch(`/api/projects/${projectId}/tasks/${taskId}/acceptance-criteria/${acId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text }),
      }).then((res) => {
        if (res.ok) {
          void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
        }
      });
    },
    [projectId, taskId, queryClient],
  );

  const handleTitleSave = () => {
    if (!titleValue.trim() || titleValue.trim() === task?.title) {
      setEditingTitle(false);
      return;
    }
    updateTask.mutate(
      { taskId, data: { title: titleValue.trim() } },
      { onSettled: () => setEditingTitle(false) },
    );
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') {
      setTitleValue(task?.title ?? '');
      setEditingTitle(false);
    }
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescValue(e.target.value);
    if (descSaveTimerRef.current) clearTimeout(descSaveTimerRef.current);
    descSaveTimerRef.current = setTimeout(() => {
      setDescSaving(true);
      updateTask.mutate(
        { taskId, data: { description: e.target.value } },
        {
          onSettled: () => setTimeout(() => setDescSaving(false), 800),
        },
      );
    }, 500);
  };

  const handleDelete = () => {
    deleteTask.mutate(taskId, {
      onSuccess: () => navigate(`/projects/${projectId}/backlog`),
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 max-w-[1280px] flex flex-col gap-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <div className="flex gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex gap-8">
          <div className="flex-1 flex flex-col gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="w-56 flex flex-col gap-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error / Not found state ────────────────────────────────────────────────
  if (isError || !task) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <p className="text-sm text-muted-foreground">
            This task doesn't exist or has been deleted.
          </p>
          <Link
            to={`/projects/${projectId}/backlog`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Backlog
          </Link>
        </div>
      </div>
    );
  }

  const acceptanceCriteria = task.acceptanceCriteria ?? [];
  const subTasks = task.subTasks ?? [];

  return (
    <div className="p-8 max-w-[1280px] mx-auto flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 -ml-2"
          onClick={() => navigate(`/projects/${projectId}/backlog`)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <span>/</span>
        <span>{project?.name ?? 'Project'}</span>
        <span>/</span>
        <span>Backlog</span>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{task.title}</span>
      </div>

      {/* Title — inline editable */}
      <div>
        {editingTitle ? (
          <Input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="text-xl font-semibold border-2 h-auto py-1"
            autoFocus
          />
        ) : (
          <h1
            className={cn(
              'text-xl font-semibold tracking-tight cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors',
              canEdit && 'hover:bg-muted/50',
            )}
            onClick={() => {
              if (!canEdit) return;
              setTitleValue(task.title);
              setEditingTitle(true);
            }}
            title={canEdit ? 'Click to edit' : undefined}
          >
            {task.title}
          </h1>
        )}
      </div>

      {/* Metadata bar */}
      <FieldGroup className="flex-row flex-wrap gap-6">
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={task.status}
            onValueChange={(val) =>
              updateTask.mutate({ taskId, data: { status: val as TaskStatus } })
            }
            disabled={!canEdit}
          >
            <SelectTrigger className="h-8 w-auto gap-2">
              <SelectValue>
                <StatusBadge status={task.status} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as TaskStatus[]).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    <StatusBadge status={s} />
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Assignee</FieldLabel>
          <Select
            value={task.assigneeId ?? 'unassigned'}
            onValueChange={(val) =>
              updateTask.mutate({
                taskId,
                data: { assigneeId: val === 'unassigned' ? null : val },
              })
            }
            disabled={!canEdit}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-muted-foreground">Unassigned</span>
              </SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[9px]">
                        {getInitials(m.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {m.user.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Sprint</FieldLabel>
          <Select
            value={task.sprintId ?? 'none'}
            onValueChange={(val) =>
              updateTask.mutate({
                taskId,
                data: { sprintId: val === 'none' ? null : val },
              })
            }
            disabled={!canEdit}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">None</span>
              </SelectItem>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="story-points">Story Points</FieldLabel>
          <Input
            id="story-points"
            type="number"
            min={1}
            max={100}
            className="h-8 w-20"
            defaultValue={task.storyPoints ?? ''}
            disabled={!canEdit}
            onBlur={(e) => {
              const val = e.target.value;
              const num = val === '' ? null : Number(val);
              if (num === task.storyPoints) return;
              updateTask.mutate({
                taskId,
                data: { storyPoints: num === null ? undefined : num },
              });
            }}
          />
        </Field>
      </FieldGroup>

      <Separator />

      {/* Content split: 65% / 35% */}
      <div className="flex gap-8">
        {/* Left: description, acceptance criteria, sub-tasks */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Description */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Description</h2>
            <div className="relative">
              <Textarea
                placeholder="Add a description..."
                value={descValue}
                onChange={handleDescChange}
                rows={4}
                disabled={!canEdit}
                className="resize-y"
              />
              {descSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          </div>

          {/* Acceptance Criteria */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">
              Acceptance Criteria
            </h2>
            <div className="flex flex-col gap-1">
              {acceptanceCriteria.map((ac) => (
                <AcceptanceCriteriaItem
                  key={ac.id}
                  ac={ac}
                  canEdit={canEdit}
                  onToggle={() => toggleCriteria(ac)}
                  onDelete={() => deleteCriteria(ac.id)}
                  onSaveText={(text) => updateCriteriaText(ac.id, text)}
                />
              ))}
            </div>
            {addingCriteria ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="size-4 shrink-0" />
                <Input
                  placeholder="Add criterion..."
                  value={newCriteriaText}
                  onChange={(e) => setNewCriteriaText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCriteria();
                    if (e.key === 'Escape') {
                      setAddingCriteria(false);
                      setNewCriteriaText('');
                    }
                  }}
                  autoFocus
                  className="h-7 text-sm"
                />
                <Button size="sm" className="h-7" onClick={addCriteria}>
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setAddingCriteria(false);
                    setNewCriteriaText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-fit gap-1 text-muted-foreground -ml-2 mt-1"
                  onClick={() => setAddingCriteria(true)}
                >
                  <Plus className="size-3.5" />
                  Add criteria
                </Button>
              )
            )}
          </div>

          {/* Sub-Tasks */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Sub-Tasks</h2>
            {subTasks.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 text-[13px] font-semibold text-muted-foreground">
                        Title
                      </th>
                      <th className="text-left px-3 py-2 text-[13px] font-semibold text-muted-foreground w-[130px]">
                        Status
                      </th>
                      <th className="text-left px-3 py-2 text-[13px] font-semibold text-muted-foreground w-[150px]">
                        Assignee
                      </th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {subTasks.map((subTask) => (
                      <SubTaskRow
                        key={subTask.id}
                        subTask={subTask}
                        members={members}
                        canEdit={canEdit}
                        onUpdate={(data) => updateSubTask.mutate({ subTaskId: subTask.id, data })}
                        onDelete={() => deleteSubTask.mutate(subTask.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {addingSubTask ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Sub-task title..."
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSubTaskTitle.trim()) {
                      createSubTask.mutate(newSubTaskTitle.trim());
                    }
                    if (e.key === 'Escape') {
                      setAddingSubTask(false);
                      setNewSubTaskTitle('');
                    }
                  }}
                  autoFocus
                  className="h-7 text-sm flex-1"
                />
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    if (newSubTaskTitle.trim()) createSubTask.mutate(newSubTaskTitle.trim());
                  }}
                  disabled={!newSubTaskTitle.trim() || createSubTask.isPending}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setAddingSubTask(false);
                    setNewSubTaskTitle('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-fit gap-1 text-muted-foreground -ml-2"
                  onClick={() => setAddingSubTask(true)}
                >
                  <Plus className="size-3.5" />
                  Add sub-task
                </Button>
              )
            )}
          </div>
        </div>

        {/* Right: sidebar metadata */}
        <div className="w-56 shrink-0 flex flex-col gap-4">
          <div className="rounded-lg border p-4 flex flex-col gap-3">
            {task.createdBy && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Created by
                </span>
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(task.createdBy.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{task.createdBy.name}</span>
                </div>
              </div>
            )}
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Created
              </span>
              <span className="text-sm text-muted-foreground">{formatRelative(task.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Updated
              </span>
              <span className="text-sm text-muted-foreground">{formatRelative(task.updatedAt)}</span>
            </div>
            {task.sprint && (
              <>
                <Separator />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Sprint
                  </span>
                  <span className="text-sm">{task.sprint.name}</span>
                </div>
              </>
            )}
          </div>

          {/* Delete action */}
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full gap-2">
                  <Trash2 className="size-4" />
                  Delete Task
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this task and all its sub-tasks. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Delete Task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Acceptance Criteria Item ───────────────────────────────────────────────

interface AcceptanceCriteriaItemProps {
  ac: AcceptanceCriteria;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSaveText: (text: string) => void;
}

function AcceptanceCriteriaItem({
  ac,
  canEdit,
  onToggle,
  onDelete,
  onSaveText,
}: AcceptanceCriteriaItemProps) {
  const [editing, setEditing] = useState(false);
  const [textValue, setTextValue] = useState(ac.text);

  const handleBlur = () => {
    setEditing(false);
    if (textValue.trim() && textValue !== ac.text) {
      onSaveText(textValue.trim());
    } else {
      setTextValue(ac.text);
    }
  };

  return (
    <div className="flex items-start gap-2 group/ac py-0.5">
      <Checkbox
        checked={ac.completed}
        onCheckedChange={onToggle}
        className="mt-0.5 shrink-0"
        disabled={!canEdit}
      />
      {editing ? (
        <Input
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleBlur();
            if (e.key === 'Escape') {
              setEditing(false);
              setTextValue(ac.text);
            }
          }}
          autoFocus
          className="h-6 text-sm py-0"
        />
      ) : (
        <span
          className={cn(
            'flex-1 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1',
            ac.completed && 'line-through text-muted-foreground',
          )}
          onClick={() => canEdit && setEditing(true)}
        >
          {ac.text}
        </span>
      )}
      {canEdit && !editing && (
        <Button
          variant="ghost"
          size="icon"
          className="size-5 opacity-0 group-hover/ac:opacity-100 shrink-0"
          onClick={onDelete}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

// ── Sub-Task Row ──────────────────────────────────────────────────────────

interface SubTaskRowProps {
  subTask: SubTask;
  members: ReturnType<typeof useMembers>['data'] extends (infer T)[] | undefined ? T[] : never[];
  canEdit: boolean;
  onUpdate: (data: { status?: TaskStatus; assigneeId?: string | null; title?: string }) => void;
  onDelete: () => void;
}

function SubTaskRow({ subTask, members, canEdit, onUpdate, onDelete }: SubTaskRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(subTask.title);

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleVal.trim() && titleVal !== subTask.title) {
      onUpdate({ title: titleVal.trim() });
    } else {
      setTitleVal(subTask.title);
    }
  };

  return (
    <tr className="border-b last:border-b-0 group/row hover:bg-muted/30">
      <td className="px-3 py-2">
        {editingTitle ? (
          <Input
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleBlur();
              if (e.key === 'Escape') {
                setEditingTitle(false);
                setTitleVal(subTask.title);
              }
            }}
            autoFocus
            className="h-6 text-sm py-0"
          />
        ) : (
          <span
            className={cn(
              'text-sm truncate block',
              canEdit && 'cursor-pointer hover:underline',
            )}
            onClick={() => canEdit && setEditingTitle(true)}
          >
            {subTask.title}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <Select
          value={subTask.status}
          onValueChange={(val) => onUpdate({ status: val as TaskStatus })}
          disabled={!canEdit}
        >
          <SelectTrigger className="h-7 border-transparent bg-transparent shadow-none p-0 focus:ring-0 w-auto">
            <SelectValue>
              <StatusBadge status={subTask.status} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as TaskStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  <StatusBadge status={s} />
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select
          value={subTask.assigneeId ?? 'unassigned'}
          onValueChange={(val) =>
            onUpdate({ assigneeId: val === 'unassigned' ? null : val })
          }
          disabled={!canEdit}
        >
          <SelectTrigger className="h-7 w-[130px]">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">
              <span className="text-muted-foreground text-sm">Unassigned</span>
            </SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                <div className="flex items-center gap-1.5">
                  <Avatar className="size-4">
                    <AvatarFallback className="text-[8px]">
                      {getInitials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{m.user.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="pr-2 py-2">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-0 group-hover/row:opacity-100"
            onClick={onDelete}
          >
            <X className="size-3" />
          </Button>
        )}
      </td>
    </tr>
  );
}
