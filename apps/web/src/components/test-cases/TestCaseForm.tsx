import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCreateTestCase, useUpdateTestCase } from '@/hooks/useTestCases';
import { StepsBuilder, type TestStep } from '@/components/test-cases/StepsBuilder';
import type { TestCase, TestModule, Priority } from '@/lib/types';

interface TestCaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  modules: TestModule[];
  editingCase?: TestCase | null;
}

interface FormErrors {
  title?: string;
  moduleId?: string;
}

export function TestCaseForm({
  open,
  onOpenChange,
  projectId,
  modules,
  editingCase,
}: TestCaseFormProps) {
  const createTestCase = useCreateTestCase(projectId);
  const updateTestCase = useUpdateTestCase(projectId);

  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [preconditions, setPreconditions] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = !!editingCase;
  const mutation = isEditing ? updateTestCase : createTestCase;

  useEffect(() => {
    if (open && editingCase) {
      setTitle(editingCase.title);
      setModuleId(editingCase.moduleId);
      setPriority(editingCase.priority ?? '');
      setPreconditions(editingCase.preconditions ?? '');
      setExpectedResult(editingCase.expectedResult ?? '');
      setEstimatedMinutes(editingCase.estimatedMinutes?.toString() ?? '');
      setTagsInput(editingCase.tags?.join(', ') ?? '');
      setSteps(
        editingCase.steps?.map((s) => ({
          position: s.position,
          action: s.action,
          expectedResult: s.expectedResult,
        })) ?? [],
      );
    }
  }, [open, editingCase]);

  const resetForm = () => {
    setTitle('');
    setModuleId('');
    setPriority('');
    setPreconditions('');
    setExpectedResult('');
    setEstimatedMinutes('');
    setTagsInput('');
    setSteps([]);
    setErrors({});
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!moduleId) newErrors.moduleId = 'Module is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      moduleId,
      priority: priority || undefined,
      preconditions: preconditions.trim() || undefined,
      expectedResult: expectedResult.trim() || undefined,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      steps: steps.length > 0 ? steps : undefined,
    };

    if (isEditing) {
      updateTestCase.mutate(
        { testCaseId: editingCase!.id, data: payload },
        {
          onSuccess: () => {
            resetForm();
            onOpenChange(false);
          },
        },
      );
    } else {
      createTestCase.mutate(payload as Parameters<typeof createTestCase.mutate>[0], {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-2xl max-h-[85vh] max-w-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Test Case' : 'New Test Case'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-title" className="text-[13px] font-semibold">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tc-title"
              placeholder="Test case title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Module */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-semibold">
              Module <span className="text-destructive">*</span>
            </Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger className="h-8" aria-invalid={!!errors.moduleId}>
                <SelectValue placeholder="Select module" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.moduleId && <p className="text-xs text-destructive">{errors.moduleId}</p>}
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-semibold">Priority</Label>
            <Select value={priority} onValueChange={(val) => setPriority(val as Priority)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="No priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BLOCKER">Blocker</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preconditions */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-preconditions" className="text-[13px] font-semibold">
              Preconditions
            </Label>
            <Textarea
              id="tc-preconditions"
              placeholder="Any preconditions for this test case"
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              rows={2}
            />
          </div>

          {/* Expected Result */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-expected" className="text-[13px] font-semibold">
              Expected Result
            </Label>
            <Textarea
              id="tc-expected"
              placeholder="Overall expected result"
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-4">
            {/* Estimated Time */}
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="tc-time" className="text-[13px] font-semibold">
                Est. Time (min)
              </Label>
              <Input
                id="tc-time"
                type="number"
                min={0}
                placeholder="Minutes"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="h-8"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="tc-tags" className="text-[13px] font-semibold">
                Tags
              </Label>
              <Input
                id="tc-tags"
                placeholder="tag1, tag2, ..."
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-semibold">Steps</Label>
            <StepsBuilder steps={steps} onChange={setSteps} />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Test Case'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
