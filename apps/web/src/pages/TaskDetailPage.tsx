import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Plus, X, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useTaskByKey, useUpdateTask, useDeleteTask, useCreateTask, useCreateTimeLog, useDeleteTimeLog } from '@/hooks/useTasks';
import { useUiStore } from '@/store/uiStore';
import { useMembers } from '@/hooks/useMembers';
import { useSprints } from '@/hooks/useSprints';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useProject } from '@/hooks/useProjects';
import { useAuth } from '@/auth/useAuth';
import { useWorkflow, useValidTransitions, useAllowedAssignees } from '@/hooks/useWorkflow';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { TimeTrackingCard } from '@/components/tasks/TimeTrackingCard';
import { TimeLogsList } from '@/components/tasks/TimeLogsList';
import { SubTaskCard } from '@/components/tasks/SubTaskCard';
import { AddSubTaskModal } from '@/components/tasks/AddSubTaskModal';
import type { AcceptanceCriteria, Priority } from '@/lib/types';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

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
      <Label className='text-sm font-normal text-muted-foreground'>{label}</Label>
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
  const { taskKey = '', projectPrefix = '' } = useParams<{ taskKey: string; projectPrefix: string }>();
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
  const descriptionUpdate = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const createTask = useCreateTask(projectId);
  const createTimeLog = useCreateTimeLog(projectId);
  const deleteTimeLog = useDeleteTimeLog(projectId);

  const { data: workflow } = useWorkflow(projectId);
  const validNextStatuses = useValidTransitions(workflow, task?.workflowStatusId ?? null);
  const { data: allowedAssignees } = useAllowedAssignees(projectId, task?.workflowStatusId ?? null);

  const taskQueryKey = ['task-by-key', projectId, taskKey] as const;

  const optimisticMutate = useCallback(
    (patch: Record<string, unknown>, payload: { taskId: string; data: Record<string, unknown> }) => {
      const prev = queryClient.getQueryData(taskQueryKey);
      queryClient.setQueryData(taskQueryKey, (old: typeof task | undefined) =>
        old ? { ...old, ...patch } : old,
      );
      updateTask.mutate(payload, {
        onError: () => queryClient.setQueryData(taskQueryKey, prev),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: taskQueryKey }),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, projectId, taskKey, updateTask],
  );

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sub-task modal
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);

  // Acceptance criteria add
  const [addingCriteria, setAddingCriteria] = useState(false);
  const [newCriteriaText, setNewCriteriaText] = useState('');

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
    const serialized = serializeAcceptanceCriteria(updated);
    setNewCriteriaText('');
    setAddingCriteria(false);
    optimisticMutate(
      { acceptanceCriteria: serialized },
      { taskId, data: { acceptanceCriteria: serialized } },
    );
  }, [newCriteriaText, task, taskId, optimisticMutate]);

  const toggleCriteria = useCallback(
    (ac: AcceptanceCriteria) => {
      if (!task) return;
      const current = parseAcceptanceCriteria(task.acceptanceCriteria);
      const updated = current.map((item) =>
        item.id === ac.id ? { ...item, completed: !item.completed } : item,
      );
      const serialized = serializeAcceptanceCriteria(updated);
      optimisticMutate(
        { acceptanceCriteria: serialized },
        { taskId, data: { acceptanceCriteria: serialized } },
      );
    },
    [task, taskId, optimisticMutate],
  );

  const deleteCriteria = useCallback(
    (acId: string) => {
      if (!task) return;
      const current = parseAcceptanceCriteria(task.acceptanceCriteria);
      const updated = current.filter((item) => item.id !== acId);
      const serialized = serializeAcceptanceCriteria(updated);
      optimisticMutate(
        { acceptanceCriteria: serialized },
        { taskId, data: { acceptanceCriteria: serialized } },
      );
    },
    [task, taskId, optimisticMutate],
  );

  const updateCriteriaText = useCallback(
    (acId: string, text: string) => {
      if (!task) return;
      const current = parseAcceptanceCriteria(task.acceptanceCriteria);
      const updated = current.map((item) =>
        item.id === acId ? { ...item, text } : item,
      );
      const serialized = serializeAcceptanceCriteria(updated);
      optimisticMutate(
        { acceptanceCriteria: serialized },
        { taskId, data: { acceptanceCriteria: serialized } },
      );
    },
    [task, taskId, optimisticMutate],
  );

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === task?.title) {
      setEditingTitle(false);
      return;
    }
    setEditingTitle(false);
    optimisticMutate({ title: trimmed }, { taskId, data: { title: trimmed } });
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
      onSuccess: () => navigate(`/projects/${projectPrefix}/backlog`),
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
            to={`/projects/${projectPrefix}/backlog`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Backlog
          </Link>
        </div>
      </div>
    );
  }

  const acceptanceCriteria = parseAcceptanceCriteria(task.acceptanceCriteria);
  const acChecked = acceptanceCriteria.filter((ac) => ac.completed).length;
  const acTotal = acceptanceCriteria.length;
  const currentUserId = user?.id ?? '';
  const isParent = (task.children?.length ?? 0) > 0;
  const hasParent = !!task.parentId;

  return (
    <div className="p-8 max-w-[1280px] mx-auto flex flex-col gap-6">
      {/* Breadcrumb nav */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 -ml-2"
          onClick={() => navigate(`/projects/${projectPrefix}/backlog`)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <span>/</span>
        <span>{project?.name ?? 'Project'}</span>
        <span>/</span>
        <span>Backlog</span>
        {task.parent && (
          <>
            <span>/</span>
            <button
              onClick={() => navigate(`/projects/${projectPrefix}/tasks/${task.parent!.taskKey}`)}
              className="hover:text-foreground truncate max-w-40"
            >
              {task.parent.taskKey}: {task.parent.title}
            </button>
          </>
        )}
        <span>/</span>
        <span className="text-foreground truncate max-w-50">{task.title}</span>
      </div>

      {/* Title — inline editable */}
      <div className='flex gap-3'>
        {/* Task key badge */}
        {task.taskKey && (
          <div className="text-sm text-center font-mono align-middle text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit">
            {task.taskKey}
          </div>
        )}

        <div className='flex-2'>
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
                  descriptionUpdate.mutate(
                    { taskId, data: { description: html } },
                    { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId, taskKey] }) },
                  )
                }
                editable={canEdit}
                projectId={projectId}
                taskId={taskId}
              />
              {descriptionUpdate.isPending && (
                <div className="flex items-center gap-1 mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Saving...</span>
                </div>
              )}
            </section>

            <hr className="border-border" />

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

            <hr className="border-border" />

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


          {/* Sub-tasks Section */}
          {!hasParent && (
            <div className="rounded-lg border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Sub-tasks ({task.children?.length ?? 0})</h3>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    onClick={() => setAddSubTaskOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                )}
              </div>
              {task.children && task.children.length > 0 ? (
                <div className="space-y-2">
                  {task.children.map((child) => (
                    <SubTaskCard key={child.id} subTask={child} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sub-tasks</p>
              )}
            </div>
          )}

          <AddSubTaskModal
            open={addSubTaskOpen}
            onOpenChange={setAddSubTaskOpen}
            onSave={(title) => createTask.mutate({ title, parentId: task.id })}
          />

          {/* CARD 2: Discussion (Comments / Activity tabs) */}
          <div className="rounded-lg border p-5">
            <Tabs defaultValue="comments">
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="timelogs">Time Logs</TabsTrigger>
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
              <TabsContent value="timelogs">
                <TimeLogsList
                  timeLogs={task.timeLogs ?? []}
                  currentUserId={currentUserId}
                  userRole={canManage ? 'pm' : ''}
                  onDelete={(timeLogId) => deleteTimeLog.mutate({ taskId: task.id, timeLogId })}
                  isDeleting={deleteTimeLog.isPending}
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
                {task.workflowStatus ? (
                  <Select
                    value={task.workflowStatusId ?? ''}
                    onValueChange={(val) =>
                      optimisticMutate(
                        { workflowStatusId: val },
                        { taskId, data: { workflowStatusId: val } },
                      )
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue>
                        <StatusBadge status={task.workflowStatus} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* Current status */}
                      <SelectItem value={task.workflowStatusId!}>
                        <StatusBadge status={task.workflowStatus} />
                      </SelectItem>
                      {/* Valid transitions */}
                      {validNextStatuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <StatusBadge status={s} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value=""
                    onValueChange={(val) =>
                      optimisticMutate(
                        { workflowStatusId: val },
                        { taskId, data: { workflowStatusId: val } },
                      )
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue>
                        <StatusBadge status={null} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(workflow?.statuses ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <StatusBadge status={s} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Assignee</SidebarLabel>
                <Select
                  value={task.assigneeId ?? 'unassigned'}
                  onValueChange={(val) => {
                    const assigneeId = val === 'unassigned' ? null : val;
                    optimisticMutate({ assigneeId }, { taskId, data: { assigneeId } });
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {(allowedAssignees ?? members.map((m) => ({
                      userId: m.userId,
                      username: m.user.username,
                      name: m.user.name ?? m.user.username,
                      imageUrl: m.user.imageUrl,
                      memberId: m.id,
                      email: m.user.email,
                    }))).map((a) => (
                      <SelectItem key={a.userId} value={a.userId}>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            {a.imageUrl && <AvatarImage src={a.imageUrl} alt={a.name ?? a.username} />}
                            <AvatarFallback className="text-[9px]">
                              {getInitials(a.name ?? a.username)}
                            </AvatarFallback>
                          </Avatar>
                          {a.name ?? a.username}
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
                  onValueChange={(val) => {
                    const sprintId = val === 'none' ? null : val;
                    optimisticMutate({ sprintId }, { taskId, data: { sprintId } });
                  }}
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
                    optimisticMutate(
                      { storyPoints: num },
                      { taskId, data: { storyPoints: num === null ? undefined : num } },
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
                      const priority = val === 'none' ? null : (val as Priority);
                      optimisticMutate({ priority }, { taskId, data: { priority } });
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

              {/* Time Tracking */}
              <TimeTrackingCard
                task={task}
                isParent={isParent}
                onEstimateChange={!isParent ? (minutes) => {
                  updateTask.mutate({
                    taskId: task.id,
                    data: { estimatedMinutes: minutes },
                  });
                } : undefined}
                onLogTime={!isParent ? (data) => {
                  createTimeLog.mutate({ taskId: task.id, data });
                } : undefined}
                isLogTimeLoading={createTimeLog.isPending}
              />

              <Separator/>

              {/* Planned dates */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Planned</SidebarLabel>
                <DatePickerField
                  label="Start"
                  value={task.plannedStartDate}
                  onChange={(iso) => optimisticMutate({ plannedStartDate: iso }, { taskId, data: { plannedStartDate: iso } })}
                  disabled={!canEdit}
                />
                <DatePickerField
                  label="End"
                  value={task.plannedEndDate}
                  onChange={(iso) => optimisticMutate({ plannedEndDate: iso }, { taskId, data: { plannedEndDate: iso } })}
                  disabled={!canEdit}
                />
              </div>

              {/* Actual dates */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Actual</SidebarLabel>
                <DatePickerField
                  label="Start"
                  value={task.actualStartDate}
                  onChange={(iso) => optimisticMutate({ actualStartDate: iso }, { taskId, data: { actualStartDate: iso } })}
                  disabled={!canEdit}
                />
                <DatePickerField
                  label="End"
                  value={task.actualEndDate}
                  onChange={(iso) => optimisticMutate({ actualEndDate: iso }, { taskId, data: { actualEndDate: iso } })}
                  disabled={!canEdit}
                />
              </div>

              <Separator />

              {/* Meta info */}
              {task.createdBy && (
                <div className="flex flex-col gap-1">
                  <SidebarLabel>Created by</SidebarLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      {task.createdBy.imageUrl && <AvatarImage src={task.createdBy.imageUrl} alt={task.createdBy.name ?? task.createdBy.username} />}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(task.createdBy.name ?? task.createdBy.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{task.createdBy.name ?? task.createdBy.username}</span>
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

