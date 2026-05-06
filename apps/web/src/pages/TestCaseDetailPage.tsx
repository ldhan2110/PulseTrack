import { useState, useRef, useEffect } from 'react';
import { AutomationPanel } from '@/components/test-cases/AutomationPanel';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useTestCaseByKey, useUpdateTestCase, useDeleteTestCase } from '@/hooks/useTestCases';
import { useTestModules } from '@/hooks/useTestModules';
import { usePermissions } from '@/hooks/usePermissions';
import { useProject } from '@/hooks/useProjects';
import { StepsBuilder, type TestStep } from '@/components/test-cases/StepsBuilder';
import { formatDistanceToNow } from 'date-fns';
import type { Priority, TestCaseStatus } from '@/lib/types';

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

const STATUS_OPTIONS: { value: TestCaseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DEPRECATED', label: 'Deprecated' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'BLOCKER', label: 'Blocker' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export function TestCaseDetailPage() {
  const { testCaseKey = '', projectPrefix = '' } = useParams<{
    testCaseKey: string;
    projectPrefix: string;
  }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();

  const { data: testCase, isLoading, isError } = useTestCaseByKey(projectId, testCaseKey);
  const testCaseId = testCase?.id ?? '';
  const [mode, setMode] = useState<'manual' | 'automation'>('manual');
  const { data: modules = [] } = useTestModules(projectId);
  const { can } = usePermissions(projectId);
  const canManage = can('testCases', 'delete');
  const { data: project } = useProject(projectId);
  const updateTestCase = useUpdateTestCase(projectId);
  const deleteTestCase = useDeleteTestCase(projectId);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  // Preconditions auto-save
  const [preconditionsValue, setPreconditionsValue] = useState('');
  const [preconditionsSaving, setPreconditionsSaving] = useState(false);
  const preconditionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expected result auto-save
  const [expectedValue, setExpectedValue] = useState('');
  const [expectedSaving, setExpectedSaving] = useState(false);
  const expectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tags
  const [tagsInput, setTagsInput] = useState('');
  const [tagsSaving, setTagsSaving] = useState(false);

  // Estimated minutes
  const [estValue, setEstValue] = useState('');
  const [estSaving, setEstSaving] = useState(false);

  // Steps
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [stepsSaving, setStepsSaving] = useState(false);
  const stepsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync data to local state
  useEffect(() => {
    if (testCase) {
      setPreconditionsValue(testCase.preconditions ?? '');
      setExpectedValue(testCase.expectedResult ?? '');
      setTagsInput(testCase.tags?.join(', ') ?? '');
      setEstValue(testCase.estimatedMinutes?.toString() ?? '');
      setSteps(
        testCase.steps?.map((s: { position: number; action: string; expectedResult: string }) => ({
          position: s.position,
          action: s.action,
          expectedResult: s.expectedResult,
        })) ?? [],
      );
    }
  }, [testCase?.id]);

  const handleTitleSave = () => {
    if (!titleValue.trim() || titleValue.trim() === testCase?.title) {
      setEditingTitle(false);
      return;
    }
    updateTestCase.mutate(
      { testCaseId, data: { title: titleValue.trim() } },
      { onSettled: () => setEditingTitle(false) },
    );
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') {
      setTitleValue(testCase?.title ?? '');
      setEditingTitle(false);
    }
  };

  const handlePreconditionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPreconditionsValue(e.target.value);
    if (preconditionsTimerRef.current) clearTimeout(preconditionsTimerRef.current);
    preconditionsTimerRef.current = setTimeout(() => {
      setPreconditionsSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { preconditions: e.target.value } },
        { onSettled: () => setTimeout(() => setPreconditionsSaving(false), 800) },
      );
    }, 500);
  };

  const handlePreconditionsBlur = () => {
    if (preconditionsTimerRef.current) {
      clearTimeout(preconditionsTimerRef.current);
      setPreconditionsSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { preconditions: preconditionsValue } },
        { onSettled: () => setTimeout(() => setPreconditionsSaving(false), 800) },
      );
    }
  };

  const handleExpectedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setExpectedValue(e.target.value);
    if (expectedTimerRef.current) clearTimeout(expectedTimerRef.current);
    expectedTimerRef.current = setTimeout(() => {
      setExpectedSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { expectedResult: e.target.value } },
        { onSettled: () => setTimeout(() => setExpectedSaving(false), 800) },
      );
    }, 500);
  };

  const handleExpectedBlur = () => {
    if (expectedTimerRef.current) {
      clearTimeout(expectedTimerRef.current);
      setExpectedSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { expectedResult: expectedValue } },
        { onSettled: () => setTimeout(() => setExpectedSaving(false), 800) },
      );
    }
  };

  const handleTagsBlur = () => {
    const newTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const currentTags = testCase?.tags ?? [];
    if (JSON.stringify(newTags) !== JSON.stringify(currentTags)) {
      setTagsSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { tags: newTags } },
        { onSettled: () => setTimeout(() => setTagsSaving(false), 800) },
      );
    }
  };

  const handleEstBlur = () => {
    const newEst = estValue ? Number(estValue) : undefined;
    if (newEst !== (testCase?.estimatedMinutes ?? undefined)) {
      setEstSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { estimatedMinutes: newEst ?? 0 } },
        { onSettled: () => setTimeout(() => setEstSaving(false), 800) },
      );
    }
  };

  const handleStepsChange = (newSteps: TestStep[]) => {
    setSteps(newSteps);
    if (stepsTimerRef.current) clearTimeout(stepsTimerRef.current);
    stepsTimerRef.current = setTimeout(() => {
      setStepsSaving(true);
      updateTestCase.mutate(
        { testCaseId, data: { steps: newSteps } },
        { onSettled: () => setTimeout(() => setStepsSaving(false), 800) },
      );
    }, 800);
  };

  const handleDelete = () => {
    deleteTestCase.mutate(testCaseId, {
      onSuccess: () => navigate(`/projects/${projectPrefix}/test-cases`),
    });
  };

  // Loading state
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
          </div>
        </div>
      </div>
    );
  }

  // Error / Not found state
  if (isError || !testCase) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <p className="text-sm text-muted-foreground">
            This test case doesn't exist or has been deleted.
          </p>
          <Link
            to={`/projects/${projectPrefix}/test-cases`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Test Cases
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
          onClick={() => navigate(`/projects/${projectPrefix}/test-cases`)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <span>/</span>
        <span>{project?.name ?? 'Project'}</span>
        <span>/</span>
        <span>Test Cases</span>
        <span>/</span>
        <span className="text-foreground font-mono text-xs">
          {testCase.testCaseKey ?? testCase.title}
        </span>
      </div>

      {/* Title - inline editable */}
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
              setTitleValue(testCase.title);
              setEditingTitle(true);
            }}
            title="Click to edit"
          >
            {testCase.testCaseKey && (
              <span className="text-muted-foreground font-mono text-base mr-2">
                {testCase.testCaseKey}
              </span>
            )}
            {testCase.title}
          </h1>
        )}
      </div>

      <Separator />

      {/* Content split */}
      <div className="flex gap-8">
        {/* Left panel */}
        <div className="flex-1 flex flex-col">
          {/* Mode toggle */}
          <div className="flex items-center mb-4">
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'manual'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setMode('manual')}
              >
                Manual
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'automation'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setMode('automation')}
              >
                Automation
              </button>
            </div>
          </div>

          {mode === 'manual' ? (
          <div className="flex flex-col gap-6">
          {/* Preconditions */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Preconditions</h2>
            <div className="relative">
              <Textarea
                placeholder="Any preconditions for this test case..."
                value={preconditionsValue}
                onChange={handlePreconditionsChange}
                onBlur={handlePreconditionsBlur}
                rows={3}
                className="resize-y"
              />
              {preconditionsSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          </div>

          {/* Expected Result */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted-foreground">Expected Result</h2>
            <div className="relative">
              <Textarea
                placeholder="Overall expected result..."
                value={expectedValue}
                onChange={handleExpectedChange}
                onBlur={handleExpectedBlur}
                rows={3}
                className="resize-y"
              />
              {expectedSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-muted-foreground">Steps</h2>
              {stepsSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <StepsBuilder steps={steps} onChange={handleStepsChange} />
            </div>
          </div>
          </div>
          ) : (
            <div className="border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
              <AutomationPanel testCaseId={testCaseId} />
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-60 shrink-0">
          <div className="sticky top-8 flex flex-col gap-4">
            <div className="rounded-lg border p-4 flex flex-col gap-4">
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Status</SidebarLabel>
                <Select
                  value={testCase.status}
                  onValueChange={(val) =>
                    updateTestCase.mutate({
                      testCaseId,
                      data: { status: val as TestCaseStatus },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Priority</SidebarLabel>
                <Select
                  value={testCase.priority ?? 'none'}
                  onValueChange={(val) =>
                    updateTestCase.mutate({
                      testCaseId,
                      data: { priority: val === 'none' ? undefined : (val as Priority) },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="No priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No priority</span>
                    </SelectItem>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Module */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Module</SidebarLabel>
                <Select
                  value={testCase.moduleId}
                  onValueChange={(val) =>
                    updateTestCase.mutate({
                      testCaseId,
                      data: { moduleId: val },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estimated Time */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Est. Time (min)</SidebarLabel>
                <Input
                  type="number"
                  min={0}
                  placeholder="Minutes"
                  value={estValue}
                  onChange={(e) => setEstValue(e.target.value)}
                  onBlur={handleEstBlur}
                  className="h-8 text-sm"
                />
                {estSaving && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1.5">
                <SidebarLabel>Tags</SidebarLabel>
                <Input
                  placeholder="tag1, tag2, ..."
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onBlur={handleTagsBlur}
                  className="h-8 text-sm"
                />
                {tagsSaving && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Saving...
                  </div>
                )}
                {testCase.tags && testCase.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {testCase.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Creator */}
              {testCase.creator && (
                <div className="flex flex-col gap-1">
                  <SidebarLabel>Creator</SidebarLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      {testCase.creator.imageUrl && (
                        <AvatarImage
                          src={testCase.creator.imageUrl}
                          alt={testCase.creator.name ?? testCase.creator.username}
                        />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(testCase.creator.name ?? testCase.creator.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {testCase.creator.name ?? testCase.creator.username}
                    </span>
                  </div>
                </div>
              )}

              <Separator />

              {/* Created / Updated */}
              <div className="flex flex-col gap-1">
                <SidebarLabel>Created</SidebarLabel>
                <span className="text-sm text-muted-foreground">
                  {testCase.createdAt ? formatRelative(testCase.createdAt) : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <SidebarLabel>Updated</SidebarLabel>
                <span className="text-sm text-muted-foreground">
                  {testCase.updatedAt ? formatRelative(testCase.updatedAt) : '—'}
                </span>
              </div>

              {/* Delete action */}
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full gap-2">
                      <Trash2 className="size-4" />
                      Delete Test Case
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Test Case</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this test case and all its steps. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={handleDelete}>
                        Delete Test Case
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
