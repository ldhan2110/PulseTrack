// apps/web/src/components/test-cases/TestCaseGenerationWizard.tsx
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, SkipForward, ChevronLeft, ChevronRight, Zap, Plus, Trash2 } from 'lucide-react';
import { useCreateTestCase } from '@/hooks/useTestCases';
import type { GeneratedTestCase, GeneratedTestCaseStep, TestModule } from '@/lib/types';

type WizardStatus = 'pending' | 'approved' | 'skipped';

interface WizardTestCase extends GeneratedTestCase {
  wizardStatus: WizardStatus;
  createdKey?: string;
  editTitle: string;
  editPreconditions: string;
  editExpectedResult: string;
  editPriority: string;
  editEstimatedMinutes: number | null;
  editTags: string[];
  editModuleId: string;
  editSteps: GeneratedTestCaseStep[];
}

interface TestCaseGenerationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCases: GeneratedTestCase[];
  projectId: string;
  modules: TestModule[];
}

export function TestCaseGenerationWizard({
  open,
  onOpenChange,
  testCases,
  projectId,
  modules,
}: TestCaseGenerationWizardProps) {
  const createTestCase = useCreateTestCase(projectId);

  const [items, setItems] = useState<WizardTestCase[]>(() =>
    testCases.map((tc) => {
      const matchedModule = modules.find(
        (m) => m.name.toLowerCase() === tc.suggestedModule?.toLowerCase(),
      );
      return {
        ...tc,
        wizardStatus: 'pending',
        editTitle: tc.title,
        editPreconditions: tc.preconditions ?? '',
        editExpectedResult: tc.expectedResult,
        editPriority: tc.priority,
        editEstimatedMinutes: tc.estimatedMinutes,
        editTags: [...tc.tags],
        editModuleId: matchedModule?.id ?? modules[0]?.id ?? '',
        editSteps: tc.steps ? tc.steps.map((s) => ({ ...s })) : [],
      };
    }),
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [newTag, setNewTag] = useState('');

  const current = items[currentIndex];
  const approvedCount = items.filter((i) => i.wizardStatus === 'approved').length;
  const totalCount = items.length;

  // Group items by sourceTaskTitle for sidebar
  const grouped = useMemo(() => {
    const groups: { title: string; indices: number[] }[] = [];
    let lastTitle = '';
    items.forEach((item, i) => {
      if (item.sourceTaskTitle !== lastTitle) {
        groups.push({ title: item.sourceTaskTitle, indices: [i] });
        lastTitle = item.sourceTaskTitle;
      } else {
        groups[groups.length - 1].indices.push(i);
      }
    });
    return groups;
  }, [items]);

  const updateField = <K extends keyof WizardTestCase>(field: K, value: WizardTestCase[K]) => {
    setItems((prev) =>
      prev.map((item, i) => (i === currentIndex ? { ...item, [field]: value } : item)),
    );
  };

  const addStep = () => {
    const steps = [...(current?.editSteps ?? [])];
    steps.push({ position: steps.length + 1, action: '', expectedResult: '' });
    updateField('editSteps', steps);
  };

  const updateStep = (stepIndex: number, field: 'action' | 'expectedResult', value: string) => {
    const steps = [...(current?.editSteps ?? [])];
    steps[stepIndex] = { ...steps[stepIndex], [field]: value };
    updateField('editSteps', steps);
  };

  const removeStep = (stepIndex: number) => {
    const steps = (current?.editSteps ?? []).filter((_, i) => i !== stepIndex);
    steps.forEach((s, i) => { s.position = i + 1; });
    updateField('editSteps', steps);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !current.editTags.includes(tag)) {
      updateField('editTags', [...current.editTags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    updateField('editTags', current.editTags.filter((t) => t !== tag));
  };

  const handleApprove = async () => {
    if (!current || !current.editModuleId) return;

    try {
      const result = await createTestCase.mutateAsync({
        title: current.editTitle,
        preconditions: current.editPreconditions || undefined,
        expectedResult: current.editExpectedResult || undefined,
        priority: current.editPriority as any,
        estimatedMinutes: current.editEstimatedMinutes ?? undefined,
        tags: current.editTags,
        moduleId: current.editModuleId,
        steps: current.editSteps.length > 0
          ? current.editSteps.map((s) => ({
              position: s.position,
              action: s.action,
              expectedResult: s.expectedResult,
            }))
          : undefined,
      });

      setItems((prev) =>
        prev.map((item, i) =>
          i === currentIndex
            ? { ...item, wizardStatus: 'approved', createdKey: result.testCaseKey ?? undefined }
            : item,
        ),
      );
      goToNextPending();
    } catch {
      // Error handled by useCreateTestCase toast
    }
  };

  const handleSkip = () => {
    setItems((prev) =>
      prev.map((item, i) => (i === currentIndex ? { ...item, wizardStatus: 'skipped' } : item)),
    );
    goToNextPending();
  };

  const handleApproveAll = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].wizardStatus !== 'pending') continue;
      const item = items[i];
      if (!item.editModuleId) continue;

      try {
        const result = await createTestCase.mutateAsync({
          title: item.editTitle,
          preconditions: item.editPreconditions || undefined,
          expectedResult: item.editExpectedResult || undefined,
          priority: item.editPriority as any,
          estimatedMinutes: item.editEstimatedMinutes ?? undefined,
          tags: item.editTags,
          moduleId: item.editModuleId,
          steps: item.editSteps.length > 0
            ? item.editSteps.map((s) => ({
                position: s.position,
                action: s.action,
                expectedResult: s.expectedResult,
              }))
            : undefined,
        });

        setItems((prev) =>
          prev.map((itm, idx) =>
            idx === i
              ? { ...itm, wizardStatus: 'approved', createdKey: result.testCaseKey ?? undefined }
              : itm,
          ),
        );
      } catch {
        // Stop on first error
        break;
      }
    }
  };

  const goToNextPending = () => {
    const nextIdx = items.findIndex((item, i) => i > currentIndex && item.wizardStatus === 'pending');
    if (nextIdx !== -1) {
      setCurrentIndex(nextIdx);
    } else {
      // Wrap around
      const wrapIdx = items.findIndex((item) => item.wizardStatus === 'pending');
      if (wrapIdx !== -1) setCurrentIndex(wrapIdx);
    }
  };

  const allDone = items.every((i) => i.wizardStatus !== 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden" style={{ maxWidth: "none"}}>
        <DialogHeader className="px-6 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Review Generated Test Cases</span>
            <Badge variant="outline">{approvedCount} / {totalCount} approved</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[500px] max-h-[calc(85vh-120px)]">
          {/* Left sidebar */}
          <div className="w-[250px] border-r overflow-y-auto shrink-0">
            {grouped.map((group) => (
              <div key={group.title}>
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b bg-muted/30 truncate">
                  From: {group.title}
                </div>
                {group.indices.map((idx) => {
                  const item = items[idx];
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 border-b cursor-pointer text-sm ${
                        idx === currentIndex ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                      } ${item.wizardStatus !== 'pending' ? 'opacity-60' : ''}`}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      <div className="flex items-center gap-1.5">
                        {item.wizardStatus === 'approved' && (
                          <Check className="size-3.5 text-green-500 shrink-0" />
                        )}
                        {item.wizardStatus === 'skipped' && (
                          <X className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={`truncate ${item.wizardStatus === 'skipped' ? 'line-through' : ''}`}>
                          {item.editTitle}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.wizardStatus === 'approved' && item.createdKey
                          ? item.createdKey
                          : item.wizardStatus === 'skipped'
                            ? 'skipped'
                            : `${item.editSteps.length} steps · ${item.editPriority}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Main content */}
          {current && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-primary uppercase tracking-wider">
                  From: {current.sourceTaskTitle} · Test Case {currentIndex + 1} of {totalCount}
                </span>
                <div className="flex gap-1.5">
                  <Badge variant="outline">{current.editPriority}</Badge>
                  {current.editEstimatedMinutes && (
                    <Badge variant="secondary">~{current.editEstimatedMinutes} min</Badge>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title</Label>
                <Input
                  value={current.editTitle}
                  onChange={(e) => updateField('editTitle', e.target.value)}
                  disabled={current.wizardStatus !== 'pending'}
                />
              </div>

              {/* Module + Priority row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Module</Label>
                  <Select
                    value={current.editModuleId}
                    onValueChange={(v) => updateField('editModuleId', v)}
                    disabled={current.wizardStatus !== 'pending'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.name.toLowerCase() === current.suggestedModule?.toLowerCase() && ' (AI suggested)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Priority</Label>
                  <Select
                    value={current.editPriority}
                    onValueChange={(v) => updateField('editPriority', v)}
                    disabled={current.wizardStatus !== 'pending'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Estimated time */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated Time (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={current.editEstimatedMinutes ?? ''}
                  onChange={(e) => updateField('editEstimatedMinutes', e.target.value ? Number(e.target.value) : null)}
                  disabled={current.wizardStatus !== 'pending'}
                  className="w-32"
                />
              </div>

              {/* Preconditions */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Preconditions</Label>
                <Textarea
                  value={current.editPreconditions}
                  onChange={(e) => updateField('editPreconditions', e.target.value)}
                  disabled={current.wizardStatus !== 'pending'}
                  className="min-h-[60px] resize-y"
                />
              </div>

              {/* Expected Result */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Expected Result</Label>
                <Textarea
                  value={current.editExpectedResult}
                  onChange={(e) => updateField('editExpectedResult', e.target.value)}
                  disabled={current.wizardStatus !== 'pending'}
                  className="min-h-[60px] resize-y"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {current.editTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      {current.wizardStatus === 'pending' && (
                        <X className="size-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      )}
                    </Badge>
                  ))}
                  {current.wizardStatus === 'pending' && (
                    <div className="flex items-center gap-1">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        placeholder="add tag"
                        className="h-6 w-24 text-xs"
                      />
                      <Button variant="ghost" size="icon" className="size-6" onClick={addTag}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Steps */}
              {current.editSteps.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Test Steps</Label>
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[36px_1fr_1fr_32px] bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                      <div className="p-2 text-center">#</div>
                      <div className="p-2">Action</div>
                      <div className="p-2">Expected Result</div>
                      <div className="p-2"></div>
                    </div>
                    {current.editSteps.map((step, si) => (
                      <div key={si} className="grid grid-cols-[36px_1fr_1fr_32px] border-t">
                        <div className="p-2 text-center text-sm font-medium text-primary">{si + 1}</div>
                        <div className="p-1 border-l">
                          <Textarea
                            value={step.action}
                            onChange={(e) => updateStep(si, 'action', e.target.value)}
                            disabled={current.wizardStatus !== 'pending'}
                            className="border-0 shadow-none min-h-[36px] resize-none text-sm p-1"
                          />
                        </div>
                        <div className="p-1 border-l">
                          <Textarea
                            value={step.expectedResult}
                            onChange={(e) => updateStep(si, 'expectedResult', e.target.value)}
                            disabled={current.wizardStatus !== 'pending'}
                            className="border-0 shadow-none min-h-[36px] resize-none text-sm p-1"
                          />
                        </div>
                        <div className="p-2 flex items-start justify-center">
                          {current.wizardStatus === 'pending' && (
                            <Button variant="ghost" size="icon" className="size-6" onClick={() => removeStep(si)}>
                              <Trash2 className="size-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {current.wizardStatus === 'pending' && (
                      <div className="border-t p-2 text-center">
                        <Button variant="ghost" size="sm" onClick={addStep}>
                          <Plus className="size-3 mr-1" /> Add Step
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No steps placeholder */}
              {current.editSteps.length === 0 && current.wizardStatus === 'pending' && (
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Test Steps</Label>
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-2">No steps generated</p>
                    <Button variant="outline" size="sm" onClick={addStep}>
                      <Plus className="size-3 mr-1" /> Add Step
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              <ChevronLeft className="size-3.5 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === items.length - 1}
              onClick={() => setCurrentIndex((i) => i + 1)}
            >
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
          <div className="flex gap-2">
            {allDone ? (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                  disabled={current?.wizardStatus !== 'pending'}
                >
                  <SkipForward className="size-3.5 mr-1" /> Skip
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={current?.wizardStatus !== 'pending' || !current?.editModuleId || createTestCase.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="size-3.5 mr-1" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApproveAll}
                  disabled={allDone || createTestCase.isPending}
                >
                  <Zap className="size-3.5 ml-1" /> Approve All
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
