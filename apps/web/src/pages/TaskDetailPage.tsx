import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Plus, X, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { RichTextEditor } from '@/components/tasks/RichTextEditor';
import { CommentThread } from '@/components/tasks/CommentThread';
import { AttachmentList } from '@/components/tasks/AttachmentList';
import { ActivityLog } from '@/components/tasks/ActivityLog';
import { useTaskByKey, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useUiStore } from '@/store/uiStore';
import { useMembers } from '@/hooks/useMembers';
import { useSprints } from '@/hooks/useSprints';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useProject } from '@/hooks/useProjects';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/lib/api';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import type { TaskStatus, AcceptanceCriteria, SubTask, Priority } from '@/lib/types';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function parseAcceptanceCriteria(raw: string | null | undefined): AcceptanceCriteria[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AcceptanceCriteria[];
    return [];
  } catch {
    // Legacy: plain string (possibly newline-delimited) — convert to array format
    if (raw.trim()) {
      return raw.split('\n').filter(Boolean).map((text, i) => ({
        id: `legacy-${i}`,
        text: text.trim(),
        completed: false,
        taskId: '',
      }));
    }
    return [];
  }
}

function serializeAcceptanceCriteria(criteria: AcceptanceCriteria[]): string {
  return JSON.stringify(criteria);
}

// ── Sidebar label component ────────────────────────────────────────────────────

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW',      label: 'Low',      color: '#6b7280' },
  { value: 'MEDIUM',   label: 'Medium',   color: '#3b82f6' },
  { value: 'HIGH',     label: 'High',     color: '#f59e0b' },
  { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
  { value: 'BLOCKER',  label: 'Blocker',  color: '#7c3aed' },
];

interface DatePickerFieldProps {
  label: string;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
}

function DatePickerField({ label, value, onChange, disabled }: DatePickerFieldProps) {
  const selected = value ? parseISO(value) : undefined;
  const displayLabel = selected ? format(selected, 'MMM d, yyyy') : 'Pick a date';

  return (
    <div className="flex items-center justify-between gap-2">
      <SidebarLabel>{label}</SidebarLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-7 gap-1.5 text-xs font-normal', !value && 'text-muted-foreground')}
            disabled={disabled}
          >
            <CalendarIcon className="size-3" />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <CalendarComponent
            mode="single"
            selected={selected}
            onSelect={(day) => onChange(day ? day.toISOString() : null)}
            initialFocus
          />
          {value && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => onChange(null)}
              >
                Clear date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TaskDetailPage() {
  const { taskKey = '' } = useParams<{ taskKey: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: task, isLoading, isError } = useTaskByKey(projectId, taskKey);
  const taskId = task?.id ?? '';
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

  // Sub-task add form
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

  // Acceptance criteria add
  const [addingCriteria, setAddingCriteria] = useState(false);
  const [newCriteriaText, setNewCriteriaText] = useState('');

  // Sub-task mutations
  const createSubTask = useMutation({
    mutationFn: (title: string) => api.createSubTask(projectId, taskId, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
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
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  const deleteSubTask = useMutation({
    mutationFn: (subTaskId: string) => api.deleteSubTask(projectId, taskId, subTaskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  // Acceptance criteria callbacks
  const addCriteria = useCallback(() => {
    if (!newCriteriaText.trim() || !task) return;
    const current = parseAcceptanceCriteria(task.acceptanceCriteria);
    const newItem: AcceptanceCriteria = {
      id: crypto.randomUUID(),
      text: newCriteriaText.trim(),
      completed: false,
      taskId: task.id,
    };
    const updated = [...current, newItem];
    updateTask.mutate(
      { taskId, data: { acceptanceCriteria: serializeAcceptanceCriteria(updated) } },
      {
        onSuccess: () => {
          setNewCriteriaText('');
          setAddingCriteria(false);
        },
        onError: () => toast.error('Something went wrong. Please try again.'),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }),
      },
    );
  }, [newCriteriaText, task, taskId, updateTask]);

  const toggleCriteria = useCallback(
    (ac: AcceptanceCriteria) => {
      if (!task) return;
      const current = parseAcceptanceCriteria(task.acceptanceCriteria);
      const updated = current.map((item) =>
        item.id === ac.id ? { ...item, completed: !item.completed } : item,
      );
      updateTask.mutate(
        { taskId, data: { acceptanceCriteria: serializeAcceptanceCriteria(updated) } },
        { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
      );
    },
    [task, taskId, updateTask, queryClient, projectId, taskKey],
  );

  const deleteCriteria = useCallback(
    (acId: string) => {
      if (!task) return;
      const current = parseAcceptanceCriteria(task.acceptanceCriteria);
      const updated = current.filter((item) => item.id !== acId);
      updateTask.mutate(
        { taskId, data: { acceptanceCriteria: serializeAcceptanceCriteria(updated) } },
        { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
      );
    },
    [task, taskId, updateTask, queryClient, projectId, taskKey],
  );

  const updateCriteriaText = useCallback(
    (acId: string, text: string) => {
      if (!task) return;
      const current = parseAcceptanceCriteria(task.acceptanceCriteria);
      const updated = current.map((item) =>
        item.id === acId ? { ...item, text } : item,
      );
      updateTask.mutate(
        { taskId, data: { acceptanceCriteria: serializeAcceptanceCriteria(updated) } },
        { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
      );
    },
    [task, taskId, updateTask, queryClient, projectId, taskKey],
  );

  const handleTitleSave = () => {
    if (!titleValue.trim() || titleValue.trim() === task?.title) {
      setEditingTitle(false);
      return;
    }
    updateTask.mutate(
      { taskId, data: { title: titleValue.trim() } },
      {
        onSettled: () => {
          setEditingTitle(false);
          void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] });
        },
      },
    );
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') {
      setTitleValue(task?.title ?? '');
      setEditingTitle(false);
    }
  };

  const handleDelete = () => {
    deleteTask.mutate(taskId, {
      onSuccess: () => navigate(`/projects/${projectId}/backlog`),
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 max-w-[1280px] mx-auto flex flex-col gap-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <Separator />
        <div className="flex gap-8">
          <div className="flex-1 flex flex-col gap-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="w-60 shrink-0 flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
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

  const acceptanceCriteria = parseAcceptanceCriteria(task.acceptanceCriteria);
  const subTasks = task.subTasks ?? [];
  const acChecked = acceptanceCriteria.filter((ac) => ac.completed).length;
  const acTotal = acceptanceCriteria.length;
  const currentUserId = user?.id ?? '';

  return (
    <div className="p-8 max-w-[1280px] mx-auto flex flex-col gap-6">
      {/* Breadcrumb nav */}
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

      {/* Task key badge */}
      {task.taskKey && (
        <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit">
          {task.taskKey}
        </span>
      )}

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
              'text-xl font-semibold tracking-tight rounded px-1 -mx-1 transition-colors',
              canEdit && 'cursor-pointer hover:bg-muted/50',
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

      <Separator />

      {/* Two-panel layout */}
      <div className="flex gap-8">
        {/* LEFT PANEL */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">

          {/* CARD 1: Task Content */}
          <div className="rounded-lg border p-5 flex flex-col gap-5">
            {/* 1. Description */}
            <section>
              <h2 className="text-[13px] font-semibold text-muted-foreground mb-2">Description</h2>
              <RichTextEditor
                initialContent={task.description ?? ''}
                onSave={(html) =>
                  updateTask.mutate(
                    { taskId, data: { description: html } },
                    { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                  )
                }
                editable={canEdit}
              />
              {updateTask.isPending && (
                <div className="flex items-center gap-1 mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Saving...</span>
                </div>
              )}
            </section>

            {/* 2. Acceptance Criteria */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[13px] font-semibold text-muted-foreground">
                  Acceptance Criteria
                </h2>
                {acTotal > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {acChecked}/{acTotal} done
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {acceptanceCriteria.length === 0 && !addingCriteria && (
                  <p className="text-sm text-muted-foreground">
                    No acceptance criteria. Add the first one.
                  </p>
                )}
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
            </section>

            {/* 3. Attachments (moved here from below comments) */}
            <section>
              <AttachmentList
                projectId={projectId}
                taskId={taskId}
                currentUserId={currentUserId}
                canManage={canManage}
              />
            </section>
          </div>

          {/* CARD 2: Discussion (Comments / Activity tabs) */}
          <div className="rounded-lg border p-5">
            <Tabs defaultValue="comments">
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="comments">
                <CommentThread
                  projectId={projectId}
                  taskId={taskId}
                  currentUserId={currentUserId}
                  canManage={canManage}
                />
              </TabsContent>
              <TabsContent value="activity">
                <ActivityLog
                  projectId={projectId}
                  taskId={taskId}
                  members={members}
                  sprints={sprints}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* RIGHT SIDEBAR — sticky */}
        <div className="w-60 shrink-0">
          <div className="sticky top-8 flex flex-col gap-4">
            <div className="rounded-lg border p-4 flex flex-col gap-4">
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Status</SidebarLabel>
                <Select
                  value={task.status}
                  onValueChange={(val) =>
                    updateTask.mutate(
                      { taskId, data: { status: val as TaskStatus } },
                      { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                    )
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-8 w-full">
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
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Assignee</SidebarLabel>
                <Select
                  value={task.assigneeId ?? 'unassigned'}
                  onValueChange={(val) =>
                    updateTask.mutate(
                      { taskId, data: { assigneeId: val === 'unassigned' ? null : val } },
                      { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                    )
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-8 w-full">
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
                              {getInitials(m.user.username)}
                            </AvatarFallback>
                          </Avatar>
                          {m.user.username}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sprint */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Sprint</SidebarLabel>
                <Select
                  value={task.sprintId ?? 'none'}
                  onValueChange={(val) =>
                    updateTask.mutate(
                      { taskId, data: { sprintId: val === 'none' ? null : val } },
                      { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                    )
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-8 w-full">
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
              </div>

              {/* Story Points */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Story Points</SidebarLabel>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="h-8"
                  defaultValue={task.storyPoints ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const num = val === '' ? null : Number(val);
                    if (num === task.storyPoints) return;
                    updateTask.mutate(
                      { taskId, data: { storyPoints: num === null ? undefined : num } },
                      { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                    );
                  }}
                />
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <SidebarLabel>Priority</SidebarLabel>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={task.priority ?? 'none'}
                    onValueChange={(val) => {
                      const newPriority = val === 'none' ? null : (val as Priority);
                      updateTask.mutate(
                        { taskId, data: { priority: newPriority } },
                        { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                      );
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-7 w-[110px] text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground text-xs">None</span>
                      </SelectItem>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ backgroundColor: opt.color }}
                            />
                            <span className="text-xs" style={{ color: opt.color }}>{opt.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Planned dates */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Planned</SidebarLabel>
                <DatePickerField
                  label="Start"
                  value={task.plannedStartDate}
                  onChange={(iso) => updateTask.mutate(
                    { taskId, data: { plannedStartDate: iso } },
                    { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                  )}
                  disabled={!canEdit}
                />
                <DatePickerField
                  label="End"
                  value={task.plannedEndDate}
                  onChange={(iso) => updateTask.mutate(
                    { taskId, data: { plannedEndDate: iso } },
                    { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                  )}
                  disabled={!canEdit}
                />
              </div>

              {/* Actual dates */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Actual</SidebarLabel>
                <DatePickerField
                  label="Start"
                  value={task.actualStartDate}
                  onChange={(iso) => updateTask.mutate(
                    { taskId, data: { actualStartDate: iso } },
                    { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                  )}
                  disabled={!canEdit}
                />
                <DatePickerField
                  label="End"
                  value={task.actualEndDate}
                  onChange={(iso) => updateTask.mutate(
                    { taskId, data: { actualEndDate: iso } },
                    { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                  )}
                  disabled={!canEdit}
                />
              </div>

              <Separator />

              {/* Sub-tasks */}
              <div className="flex flex-col gap-2">
                <SidebarLabel>Sub-Tasks</SidebarLabel>
                {subTasks.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {subTasks.map((subTask) => (
                      <SubTaskMiniRow
                        key={subTask.id}
                        subTask={subTask}
                        members={members}
                        canEdit={canEdit}
                        onUpdate={(data) =>
                          updateSubTask.mutate({ subTaskId: subTask.id, data })
                        }
                        onDelete={() => deleteSubTask.mutate(subTask.id)}
                      />
                    ))}
                  </div>
                )}
                {addingSubTask ? (
                  <div className="flex flex-col gap-1">
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
                      className="h-7 text-sm"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 flex-1"
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

              <Separator />

              {/* Meta info */}
              {task.createdBy && (
                <div className="flex flex-col gap-1">
                  <SidebarLabel>Created by</SidebarLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[9px]">
                        {getInitials(task.createdBy.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{task.createdBy.username}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <SidebarLabel>Created</SidebarLabel>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(task.createdAt)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <SidebarLabel>Updated</SidebarLabel>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(task.updatedAt)}
                </span>
              </div>
              {task.sprint && (
                <div className="flex flex-col gap-1">
                  <SidebarLabel>Sprint</SidebarLabel>
                  <span className="text-sm">{task.sprint.name}</span>
                </div>
              )}
            </div>

            {/* Delete Task */}
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
                    <AlertDialogAction variant="destructive" onClick={handleDelete}>
                      Delete Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Acceptance Criteria Item ───────────────────────────────────────────────────

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
            'flex-1 text-sm rounded px-1 -mx-1',
            canEdit && 'cursor-pointer hover:bg-muted/50',
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

// ── Sub-Task Mini Row (sidebar compact version) ────────────────────────────────

interface SubTaskMiniRowProps {
  subTask: SubTask;
  members: ReturnType<typeof useMembers>['data'] extends (infer T)[] | undefined ? T[] : never[];
  canEdit: boolean;
  onUpdate: (data: { status?: TaskStatus; assigneeId?: string | null; title?: string }) => void;
  onDelete: () => void;
}

function SubTaskMiniRow({ subTask, canEdit, onUpdate, onDelete }: SubTaskMiniRowProps) {
  return (
    <div className="flex items-center gap-1.5 group/subtask py-0.5">
      <StatusBadge status={subTask.status} />
      <span className="text-xs flex-1 truncate">{subTask.title}</span>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-5 opacity-0 group-hover/subtask:opacity-100 shrink-0"
          onClick={onDelete}
        >
          <X className="size-3" />
        </Button>
      )}
      {/* Status update via select */}
      <Select
        value={subTask.status}
        onValueChange={(val) => onUpdate({ status: val as TaskStatus })}
        disabled={!canEdit}
      >
        <SelectTrigger className="h-6 w-6 p-0 border-0 shadow-none opacity-0 group-hover/subtask:opacity-100 [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as TaskStatus[]).map((s) => (
            <SelectItem key={s} value={s}>
              <StatusBadge status={s} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
