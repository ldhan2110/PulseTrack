import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { ArrowLeft, Trash2, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextEditor } from '@/components/tasks/RichTextEditor';
import { Separator } from '@/components/ui/separator';
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
import { useBugByKey, useUpdateBug, useDeleteBug } from '@/hooks/useBugs';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { useProject } from '@/hooks/useProjects';
import { useWorkflow, useValidTransitions } from '@/hooks/useWorkflow';
import { useAuth } from '@/auth/useAuth';
import { formatDistanceToNow } from 'date-fns';
import type { BugSeverity } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ReproStepsList } from '@/components/bugs/ReproStepsList';
import { BugAttachments } from '@/components/bugs/BugAttachments';
import { BugCommentThread } from '@/components/bugs/BugCommentThread';
import { BugActivityLog } from '@/components/bugs/BugActivityLog';
import { WatcherSelect } from '@/components/tasks/WatcherSelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
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

const SEVERITY_OPTIONS: { value: BugSeverity; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export function BugDetailPage() {
  const { bugKey = '', projectPrefix = '' } = useParams<{ bugKey: string; projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const { data: bug, isLoading, isError } = useBugByKey(projectId, bugKey);
  const bugId = bug?.id ?? '';
  const { data: members = [] } = useMembers(projectId);
  const { can } = usePermissions(projectId);
  const { data: project } = useProject(projectId);
  const updateBug = useUpdateBug(projectId);
  const deleteBug = useDeleteBug(projectId);
  const { data: workflow } = useWorkflow(projectId, 'BUG');
  const validTransitions = useValidTransitions(workflow, bug?.workflowStatusId ?? null);

  // Assignee combobox
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  // Owner combobox
  const [ownerOpen, setOwnerOpen] = useState(false);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  // Description auto-save
  const [descValue, setDescValue] = useState('');

  // Environment auto-save
  const [envValue, setEnvValue] = useState('');
  const [envSaving, setEnvSaving] = useState(false);

  // Sync bug data to local state when loaded
  useEffect(() => {
    if (bug) {
      setDescValue(bug.description ?? '');
      setEnvValue(bug.environment ?? '');
    }
  }, [bug?.id]);

  const handleTitleSave = () => {
    if (!titleValue.trim() || titleValue.trim() === bug?.title) {
      setEditingTitle(false);
      return;
    }
    updateBug.mutate(
      { bugId, data: { title: titleValue.trim() } },
      { onSettled: () => setEditingTitle(false) },
    );
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') {
      setTitleValue(bug?.title ?? '');
      setEditingTitle(false);
    }
  };

  const handleEnvBlur = () => {
    if (envValue !== (bug?.environment ?? '')) {
      setEnvSaving(true);
      updateBug.mutate(
        { bugId, data: { environment: envValue } },
        { onSettled: () => setTimeout(() => setEnvSaving(false), 800) },
      );
    }
  };

  const handleDelete = () => {
    deleteBug.mutate(bugId, {
      onSuccess: () => navigate(`/projects/${projectPrefix}/bugs`),
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <div className="flex gap-8">
          <div className="flex-1 flex flex-col gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="w-60 flex flex-col gap-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error / Not found state ────────────────────────────────────────────────
  if (isError || !bug) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <p className="text-sm text-muted-foreground">
            This bug doesn't exist or has been deleted.
          </p>
          <Link
            to={`/projects/${projectPrefix}/bugs`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Bugs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 -ml-2"
          onClick={() => navigate(`/projects/${projectPrefix}/bugs`)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <span>/</span>
        <span>{project?.name ?? 'Project'}</span>
        <span>/</span>
        <span>Bugs</span>
        <span>/</span>
        <span className="text-foreground font-mono text-xs">{bug.bugKey ?? bug.title}</span>
      </div>

      {/* Title — inline editable */}
      <div>
        {editingTitle ? (
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="text-xl font-semibold border-2 h-auto py-1"
            autoFocus
          />
        ) : (
          <h1
            className="text-xl font-semibold tracking-tight cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
            onClick={() => {
              setTitleValue(bug.title);
              setEditingTitle(true);
            }}
            title="Click to edit"
          >
            {bug.bugKey && (
              <span className="text-muted-foreground font-mono text-base mr-2">{bug.bugKey}</span>
            )}
            {bug.title}
          </h1>
        )}
      </div>

      <Separator />

      {/* Content split */}
      <div className="flex gap-8">
        {/* Left: description, steps to reproduce, expected/actual, attachments, comments */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Description */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Description</h2>
            <RichTextEditor
              initialContent={descValue}
              onSave={(html) => {
                updateBug.mutate({ bugId, data: { description: html } });
              }}
              editable={true}
              projectId={projectId}
              entityType="bug"
              entityId={bugId}
              placeholder="Add a description..."
            />
          </div>

          {/* Reproduction Steps */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Reproduction Steps</h2>
            <ReproStepsList
              steps={(bug.reproSteps ?? []).map(s => ({ position: s.position, content: s.content }))}
              onChange={(steps) => {
                updateBug.mutate({ bugId, data: { reproSteps: steps } });
              }}
            />
          </div>

          {/* Expected / Actual Result */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold text-muted-foreground">Expected Result</h2>
              <RichTextEditor
                initialContent={bug.expectedResult ?? ''}
                onSave={(html) => updateBug.mutate({ bugId, data: { expectedResult: html } })}
                editable={true}
                projectId={projectId}
                entityType="bug"
                entityId={bugId}
              />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold text-muted-foreground">Actual Result</h2>
              <RichTextEditor
                initialContent={bug.actualResult ?? ''}
                onSave={(html) => updateBug.mutate({ bugId, data: { actualResult: html } })}
                editable={true}
                projectId={projectId}
                entityType="bug"
                entityId={bugId}
              />
            </div>
          </div>

          {/* Attachments */}
          <BugAttachments
            projectId={projectId}
            bugId={bugId}
            attachments={bug.attachments ?? []}
            canEdit={can('attachments', 'create')}
          />

          {/* Comments & Activity */}
          <div className="rounded-lg border p-5">
            <Tabs defaultValue="comments">
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="comments">
                <BugCommentThread
                  projectId={projectId}
                  bugId={bugId}
                  currentUserId={currentUserId}
                  canManage={can('comments', 'delete')}
                />
              </TabsContent>
              <TabsContent value="activity" className="max-h-[500px] overflow-y-auto">
                <BugActivityLog
                  projectId={projectId}
                  bugId={bugId}
                  members={members}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-60 shrink-0">
          <div className="sticky top-8 flex flex-col gap-4">
            <div className="rounded-lg border p-4 flex flex-col gap-4">
              {/* Watchers */}
              {bug && user && (
                <>
                  <WatcherSelect
                    projectId={projectId}
                    entityType="BUG"
                    entityId={bug.id}
                    currentUserId={user.id}
                  />
                </>
              )}
              <Separator />
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Status</SidebarLabel>
                <Select
                  value={bug.workflowStatusId ?? ''}
                  onValueChange={(val) => updateBug.mutate({ bugId, data: { workflowStatusId: val } })}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue>
                      {bug.workflowStatus && (
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: bug.workflowStatus.color }} />
                          {bug.workflowStatus.name}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {bug.workflowStatus && (
                      <SelectItem value={bug.workflowStatus.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: bug.workflowStatus.color }} />
                          {bug.workflowStatus.name}
                        </span>
                      </SelectItem>
                    )}
                    {validTransitions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Severity</SidebarLabel>
                <Select
                  value={bug.severity}
                  onValueChange={(val) =>
                    updateBug.mutate({ bugId, data: { severity: val as BugSeverity } })
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Assignee</SidebarLabel>
                {(() => {
                  const currentAssignee = members.find((m) => m.userId === bug.assigneeId);
                  const assigneeLabel = currentAssignee ? (currentAssignee.user.name ?? currentAssignee.user.username) : 'Unassigned';
                  return (
                    <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={assigneeOpen}
                          className="h-8 w-full justify-between font-normal"
                        >
                          {currentAssignee ? (
                            <span className="flex items-center gap-2 truncate text-sm">
                              <Avatar className="size-5 shrink-0">
                                {currentAssignee.user.imageUrl && <AvatarImage src={currentAssignee.user.imageUrl} alt={assigneeLabel} />}
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
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search members..." />
                          <CommandList className="max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="unassigned"
                                onSelect={() => {
                                  updateBug.mutate({ bugId, data: { assigneeId: null } });
                                  setAssigneeOpen(false);
                                }}
                              >
                                <Check className={cn('mr-2 size-4', !bug.assigneeId ? 'opacity-100' : 'opacity-0')} />
                                <span className="text-muted-foreground">Unassigned</span>
                              </CommandItem>
                              {members.map((m) => (
                                <CommandItem
                                  key={m.userId}
                                  value={m.user.name ?? m.user.username}
                                  onSelect={() => {
                                    updateBug.mutate({ bugId, data: { assigneeId: m.userId } });
                                    setAssigneeOpen(false);
                                  }}
                                >
                                  <Check className={cn('mr-2 size-4', bug.assigneeId === m.userId ? 'opacity-100' : 'opacity-0')} />
                                  <Avatar className="size-5 mr-1.5">
                                    {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? m.user.username} />}
                                    <AvatarFallback className="text-[9px]">
                                      {getInitials(m.user.name ?? m.user.username)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {m.user.name ?? m.user.username}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </div>

              {/* Bug Owner */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Bug Owner</SidebarLabel>
                {(() => {
                  const currentOwner = members.find((m) => m.userId === bug.ownerId);
                  const ownerLabel = currentOwner ? (currentOwner.user.name ?? currentOwner.user.username) : 'No owner';
                  return (
                    <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={ownerOpen}
                          className="h-8 w-full justify-between font-normal"
                        >
                          {currentOwner ? (
                            <span className="flex items-center gap-2 truncate text-sm">
                              <Avatar className="size-5 shrink-0">
                                {currentOwner.user.imageUrl && <AvatarImage src={currentOwner.user.imageUrl} alt={ownerLabel} />}
                                <AvatarFallback className="text-[9px]">{getInitials(ownerLabel)}</AvatarFallback>
                              </Avatar>
                              {ownerLabel}
                            </span>
                          ) : (
                            <span className="truncate text-sm text-muted-foreground">No owner</span>
                          )}
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search members..." />
                          <CommandList className="max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="no-owner"
                                onSelect={() => {
                                  updateBug.mutate({ bugId, data: { ownerId: null } });
                                  setOwnerOpen(false);
                                }}
                              >
                                <Check className={cn('mr-2 size-4', !bug.ownerId ? 'opacity-100' : 'opacity-0')} />
                                <span className="text-muted-foreground">No owner</span>
                              </CommandItem>
                              {members.map((m) => (
                                <CommandItem
                                  key={m.userId}
                                  value={m.user.name ?? m.user.username}
                                  onSelect={() => {
                                    updateBug.mutate({ bugId, data: { ownerId: m.userId } });
                                    setOwnerOpen(false);
                                  }}
                                >
                                  <Check className={cn('mr-2 size-4', bug.ownerId === m.userId ? 'opacity-100' : 'opacity-0')} />
                                  <Avatar className="size-5 mr-1.5">
                                    {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? m.user.username} />}
                                    <AvatarFallback className="text-[9px]">
                                      {getInitials(m.user.name ?? m.user.username)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {m.user.name ?? m.user.username}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </div>

              {/* Environment */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Environment</SidebarLabel>
                <Input
                  placeholder="e.g., Chrome 120"
                  value={envValue}
                  onChange={(e) => setEnvValue(e.target.value)}
                  onBlur={handleEnvBlur}
                  className="h-8 text-sm"
                />
                {envSaving && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>

              <Separator />

              {/* Parent Task */}
              {bug.parentTask && (
                <div className="flex flex-col gap-1">
                  <SidebarLabel>Parent Task</SidebarLabel>
                  <Link
                    to={`/projects/${projectPrefix}/tasks/${bug.parentTask.taskKey}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {bug.parentTask.taskKey} — {bug.parentTask.title}
                  </Link>
                </div>
              )}

              {/* Reporter */}
              {bug.reporter && (
                <div className="flex flex-col gap-1">
                  <SidebarLabel>Reporter</SidebarLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      {bug.reporter.imageUrl && <AvatarImage src={bug.reporter.imageUrl} alt={bug.reporter.name ?? bug.reporter.username} />}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(bug.reporter.name ?? bug.reporter.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{bug.reporter.name ?? bug.reporter.username}</span>
                  </div>
                </div>
              )}

              <Separator />

              {/* Created / Updated */}
              <div className="flex flex-col gap-1">
                <SidebarLabel>Created</SidebarLabel>
                <span className="text-sm text-muted-foreground">{formatRelative(bug.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <SidebarLabel>Updated</SidebarLabel>
                <span className="text-sm text-muted-foreground">{formatRelative(bug.updatedAt)}</span>
              </div>

              {/* Delete action */}
              {can('bugs', 'delete') && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full gap-2">
                      <Trash2 className="size-4" />
                      Delete Bug
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Bug</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this bug report. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={handleDelete}
                      >
                        Delete Bug
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
