import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useBug, useUpdateBug, useDeleteBug } from '@/hooks/useBugs';
import { useMembers } from '@/hooks/useMembers';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useProject } from '@/hooks/useProjects';
import { formatDistanceToNow } from 'date-fns';
import type { BugSeverity, BugStatus } from '@/lib/types';
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

export function BugDetailPage() {
  const { projectId = '', bugId = '' } = useParams<{ projectId: string; bugId: string }>();
  const navigate = useNavigate();

  const { data: bug, isLoading, isError } = useBug(projectId, bugId);
  const { data: members = [] } = useMembers(projectId);
  const { canManage } = useProjectRole(projectId);
  const { data: project } = useProject(projectId);
  const updateBug = useUpdateBug(projectId);
  const deleteBug = useDeleteBug(projectId);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  // Description auto-save
  const [descValue, setDescValue] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Steps to reproduce auto-save
  const [stepsValue, setStepsValue] = useState('');
  const [stepsSaving, setStepsSaving] = useState(false);
  const stepsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Environment auto-save
  const [envValue, setEnvValue] = useState('');
  const [envSaving, setEnvSaving] = useState(false);

  // Sync bug data to local state when loaded
  useEffect(() => {
    if (bug) {
      setDescValue(bug.description ?? '');
      setStepsValue(bug.stepsToReproduce ?? '');
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

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescValue(e.target.value);
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      setDescSaving(true);
      updateBug.mutate(
        { bugId, data: { description: e.target.value } },
        { onSettled: () => setTimeout(() => setDescSaving(false), 800) },
      );
    }, 500);
  };

  const handleDescBlur = () => {
    if (descTimerRef.current) {
      clearTimeout(descTimerRef.current);
      setDescSaving(true);
      updateBug.mutate(
        { bugId, data: { description: descValue } },
        { onSettled: () => setTimeout(() => setDescSaving(false), 800) },
      );
    }
  };

  const handleStepsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStepsValue(e.target.value);
    if (stepsTimerRef.current) clearTimeout(stepsTimerRef.current);
    stepsTimerRef.current = setTimeout(() => {
      setStepsSaving(true);
      updateBug.mutate(
        { bugId, data: { stepsToReproduce: e.target.value } },
        { onSettled: () => setTimeout(() => setStepsSaving(false), 800) },
      );
    }, 500);
  };

  const handleStepsBlur = () => {
    if (stepsTimerRef.current) {
      clearTimeout(stepsTimerRef.current);
      setStepsSaving(true);
      updateBug.mutate(
        { bugId, data: { stepsToReproduce: stepsValue } },
        { onSettled: () => setTimeout(() => setStepsSaving(false), 800) },
      );
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
      onSuccess: () => navigate(`/projects/${projectId}/bugs`),
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
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
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
  if (isError || !bug) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <p className="text-sm text-muted-foreground">
            This bug doesn't exist or has been deleted.
          </p>
          <Link
            to={`/projects/${projectId}/bugs`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Bugs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1280px] mx-auto flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 -ml-2"
          onClick={() => navigate(`/projects/${projectId}/bugs`)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <span>/</span>
        <span>{project?.name ?? 'Project'}</span>
        <span>/</span>
        <span>Bugs</span>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{bug.title}</span>
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
            {bug.title}
          </h1>
        )}
      </div>

      {/* Metadata bar */}
      <FieldGroup className="flex-row flex-wrap gap-6">
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={bug.status}
            onValueChange={(val) =>
              updateBug.mutate({ bugId, data: { status: val as BugStatus } })
            }
          >
            <SelectTrigger className="h-8 w-auto gap-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_FIX">In Fix</SelectItem>
              <SelectItem value="FIXED">Fixed</SelectItem>
              <SelectItem value="VERIFIED">Verified</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Severity</FieldLabel>
          <Select
            value={bug.severity}
            onValueChange={(val) =>
              updateBug.mutate({ bugId, data: { severity: val as BugSeverity } })
            }
          >
            <SelectTrigger className="h-8 w-auto gap-2">
              <SelectValue />
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
          <FieldLabel>Assignee</FieldLabel>
          <Select
            value={bug.assigneeId ?? 'unassigned'}
            onValueChange={(val) =>
              updateBug.mutate({
                bugId,
                data: { assigneeId: val === 'unassigned' ? null : val },
              })
            }
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
      </FieldGroup>

      <Separator />

      {/* Content split */}
      <div className="flex gap-8">
        {/* Left: description, steps to reproduce, environment */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Description */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Description</h2>
            <div className="relative">
              <Textarea
                placeholder="Add a description..."
                value={descValue}
                onChange={handleDescChange}
                onBlur={handleDescBlur}
                rows={4}
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

          {/* Reproduction Steps */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Reproduction Steps</h2>
            <div className="relative">
              <Textarea
                placeholder="Steps to reproduce..."
                value={stepsValue}
                onChange={handleStepsChange}
                onBlur={handleStepsBlur}
                rows={4}
                className="resize-y"
              />
              {stepsSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          </div>

          {/* Environment */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Environment</h2>
            <div className="relative">
              <Input
                placeholder="e.g., Chrome 120, Windows 11"
                value={envValue}
                onChange={(e) => setEnvValue(e.target.value)}
                onBlur={handleEnvBlur}
              />
              {envSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: sidebar metadata */}
        <div className="w-56 shrink-0 flex flex-col gap-4">
          <div className="rounded-lg border p-4 flex flex-col gap-3">
            {bug.reporter && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Reporter
                </span>
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(bug.reporter.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{bug.reporter.name}</span>
                </div>
              </div>
            )}
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Created
              </span>
              <span className="text-sm text-muted-foreground">{formatRelative(bug.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Updated
              </span>
              <span className="text-sm text-muted-foreground">{formatRelative(bug.updatedAt)}</span>
            </div>
          </div>

          {/* Delete action — PM only */}
          {canManage && (
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
  );
}
