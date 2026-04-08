// apps/web/src/components/tasks/TaskGenerationWizard.tsx
import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Check,
  SkipForward,
  ChevronLeft,
  CheckCheck,
  Sparkles,
  X,
  Plus,
} from 'lucide-react';
import { useCreateTask } from '@/hooks/useTasks';
import type { GeneratedTask, Priority } from '@/lib/types';

type TaskStatus = 'pending' | 'approved' | 'skipped';

interface FlatTask {
  task: GeneratedTask;
  parentIndex: number | null;
  status: TaskStatus;
  createdTaskId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const FIBONACCI = [1, 2, 3, 5, 8, 13];

function serializeAcceptanceCriteria(criteria: string[]): string {
  return JSON.stringify(
    criteria.map((text) => ({
      id: crypto.randomUUID(),
      text,
      completed: false,
      taskId: '',
    })),
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: GeneratedTask[];
  projectId: string;
  onComplete: () => void;
}

export function TaskGenerationWizard({ open, onOpenChange, tasks, projectId, onComplete }: Props) {
  const createTask = useCreateTask(projectId);

  // Flatten task tree into ordered list
  const initialFlat = useMemo(() => {
    const flat: FlatTask[] = [];
    tasks.forEach((task, i) => {
      flat.push({ task: { ...task, acceptanceCriteria: [...task.acceptanceCriteria] }, parentIndex: null, status: 'pending' });
      if (task.subTasks) {
        task.subTasks.forEach((sub) => {
          flat.push({ task: { ...sub, acceptanceCriteria: [...sub.acceptanceCriteria] }, parentIndex: i, status: 'pending' });
        });
      }
    });
    return flat;
  }, [tasks]);

  const [flatTasks, setFlatTasks] = useState<FlatTask[]>(initialFlat);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [editingAcIndex, setEditingAcIndex] = useState<number | null>(null);
  const [acEditValue, setAcEditValue] = useState('');
  const [addingCriteria, setAddingCriteria] = useState(false);
  const [newCriteriaText, setNewCriteriaText] = useState('');

  const current = flatTasks[currentIndex];
  const isComplete = currentIndex >= flatTasks.length;

  const hasValidCriteria = current?.task.acceptanceCriteria.length > 0;

  // Helper to update a task's data in the flat array
  const updateTaskData = useCallback(
    (index: number, patch: Partial<GeneratedTask>) => {
      setFlatTasks((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          task: { ...updated[index].task, ...patch },
        };
        return updated;
      });
    },
    [],
  );

  // Find the parent's created task ID for sub-tasks
  const getParentTaskId = useCallback(
    (flat: FlatTask[], index: number): string | undefined => {
      const item = flat[index];
      if (item.parentIndex === null) return undefined;
      let parentFlatIdx = -1;
      let topLevelCount = -1;
      for (let i = 0; i < flat.length; i++) {
        if (flat[i].parentIndex === null) topLevelCount++;
        if (topLevelCount === item.parentIndex) {
          parentFlatIdx = i;
          break;
        }
      }
      return parentFlatIdx >= 0 ? flat[parentFlatIdx].createdTaskId : undefined;
    },
    [],
  );

  const resetInlineEditing = useCallback(() => {
    setEditingTitle(false);
    setEditingDesc(false);
    setEditingAcIndex(null);
    setAddingCriteria(false);
    setNewCriteriaText('');
  }, []);

  const moveNext = useCallback(() => {
    let next = currentIndex + 1;
    if (flatTasks[currentIndex]?.status === 'skipped' && flatTasks[currentIndex]?.parentIndex === null) {
      const parentTopIdx = flatTasks.slice(0, currentIndex + 1).filter((f) => f.parentIndex === null).length - 1;
      while (next < flatTasks.length && flatTasks[next].parentIndex === parentTopIdx) {
        setFlatTasks((prev) => {
          const updated = [...prev];
          updated[next] = { ...updated[next], status: 'skipped' };
          return updated;
        });
        next++;
      }
    }
    setCurrentIndex(next);
    resetInlineEditing();
  }, [currentIndex, flatTasks, resetInlineEditing]);

  const handleApprove = async () => {
    const taskData = current.task;
    const parentId = current.parentIndex !== null ? getParentTaskId(flatTasks, currentIndex) : undefined;

    if (current.parentIndex !== null && !parentId) {
      setFlatTasks((prev) => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], status: 'skipped' };
        return updated;
      });
      moveNext();
      return;
    }

    try {
      const created = await createTask.mutateAsync({
        title: taskData.title,
        description: taskData.description,
        acceptanceCriteria: serializeAcceptanceCriteria(taskData.acceptanceCriteria),
        priority: taskData.priority as Priority,
        storyPoints: taskData.storyPoints,
        parentId,
      });

      setFlatTasks((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...updated[currentIndex],
          status: 'approved',
          createdTaskId: created.id,
        };
        return updated;
      });

      moveNext();
    } catch {
      // Error toast handled by useCreateTask
    }
  };

  const handleSkip = () => {
    setFlatTasks((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], status: 'skipped' };
      return updated;
    });
    moveNext();
  };

  const handleApproveAll = async () => {
    for (let i = currentIndex; i < flatTasks.length; i++) {
      if (flatTasks[i].status !== 'pending') continue;
      const task = flatTasks[i].task;
      const parentId = flatTasks[i].parentIndex !== null ? getParentTaskId(flatTasks, i) : undefined;

      if (flatTasks[i].parentIndex !== null && !parentId) continue;
      if (task.acceptanceCriteria.length === 0) continue;

      try {
        const created = await createTask.mutateAsync({
          title: task.title,
          description: task.description,
          acceptanceCriteria: serializeAcceptanceCriteria(task.acceptanceCriteria),
          priority: task.priority as Priority,
          storyPoints: task.storyPoints,
          parentId,
        });

        setFlatTasks((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'approved', createdTaskId: created.id };
          return updated;
        });
      } catch {
        break;
      }
    }
    setCurrentIndex(flatTasks.length);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      // Auto-save any in-progress inline edits before navigating
      if (editingTitle) saveTitle();
      if (editingDesc) saveDesc();
      if (editingAcIndex !== null) saveAc();
      setCurrentIndex(currentIndex - 1);
      resetInlineEditing();
    }
  };

  // --- Inline editing handlers ---

  const startEditTitle = () => {
    setEditingTitle(true);
    setTitleValue(current.task.title);
  };

  const saveTitle = () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== current.task.title) {
      updateTaskData(currentIndex, { title: trimmed });
    }
    setEditingTitle(false);
  };

  const startEditDesc = () => {
    setEditingDesc(true);
    setDescValue(current.task.description);
  };

  const saveDesc = () => {
    if (descValue !== current.task.description) {
      updateTaskData(currentIndex, { description: descValue });
    }
    setEditingDesc(false);
  };

  const startEditAc = (index: number) => {
    setEditingAcIndex(index);
    setAcEditValue(current.task.acceptanceCriteria[index]);
  };

  const saveAc = () => {
    if (editingAcIndex === null) return;
    const trimmed = acEditValue.trim();
    if (trimmed && trimmed !== current.task.acceptanceCriteria[editingAcIndex]) {
      const updated = [...current.task.acceptanceCriteria];
      updated[editingAcIndex] = trimmed;
      updateTaskData(currentIndex, { acceptanceCriteria: updated });
    }
    setEditingAcIndex(null);
  };

  const removeAc = (index: number) => {
    const updated = current.task.acceptanceCriteria.filter((_, i) => i !== index);
    updateTaskData(currentIndex, { acceptanceCriteria: updated });
  };

  const addCriteria = () => {
    const trimmed = newCriteriaText.trim();
    if (!trimmed) return;
    const updated = [...current.task.acceptanceCriteria, trimmed];
    updateTaskData(currentIndex, { acceptanceCriteria: updated });
    setNewCriteriaText('');
    setAddingCriteria(false);
  };

  // Counts
  const skipped = flatTasks.filter((t) => t.status === 'skipped').length;
  const parentApproved = flatTasks.filter((t) => t.status === 'approved' && t.parentIndex === null).length;
  const subApproved = flatTasks.filter((t) => t.status === 'approved' && t.parentIndex !== null).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            Review Generated Tasks
            <Badge variant="outline" className="ml-2">
              {Math.min(currentIndex + 1, flatTasks.length)} / {flatTasks.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar — task list */}
          <div className="w-56 border-r shrink-0">
            <ScrollArea className="h-full p-3">
              <div className="space-y-1">
                {flatTasks.map((ft, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (ft.status !== 'pending' || idx === currentIndex) {
                        setCurrentIndex(idx);
                        resetInlineEditing();
                      }
                    }}
                    className={`w-full text-left rounded px-2 py-1.5 text-xs transition-colors ${
                      idx === currentIndex
                        ? 'bg-primary/10 text-primary font-medium'
                        : ft.status === 'approved'
                          ? 'text-green-600 dark:text-green-400'
                          : ft.status === 'skipped'
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground hover:bg-muted'
                    } ${ft.parentIndex !== null ? 'ml-3' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {ft.status === 'approved' && <Check className="size-3 shrink-0" />}
                      {ft.status === 'skipped' && <SkipForward className="size-3 shrink-0" />}
                      <span className="truncate">{ft.task.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6 py-4">
              {isComplete ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <CheckCheck className="size-12 text-green-500" />
                  <h2 className="text-lg font-semibold">Generation Complete</h2>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Created {parentApproved} tasks and {subApproved} sub-tasks</p>
                    {skipped > 0 && <p>{skipped} skipped</p>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Close
                    </Button>
                    <Button onClick={onComplete}>
                      View Tasks
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {current.parentIndex !== null && (
                    <Badge variant="secondary" className="text-xs">Sub-task</Badge>
                  )}

                  {/* Title — inline editable */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    {editingTitle ? (
                      <Input
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle();
                          if (e.key === 'Escape') setEditingTitle(false);
                        }}
                        maxLength={200}
                        autoFocus
                      />
                    ) : (
                      <h3
                        className="text-base font-semibold cursor-pointer rounded px-2 py-1 -mx-2 hover:bg-muted/50 transition-colors"
                        onClick={startEditTitle}
                      >
                        {current.task.title}
                      </h3>
                    )}
                  </div>

                  {/* Priority + Story Points — always-visible Selects */}
                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      <Select
                        value={current.task.priority}
                        onValueChange={(v) =>
                          updateTaskData(currentIndex, { priority: v as GeneratedTask['priority'] })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Story Points</Label>
                      <Select
                        value={String(current.task.storyPoints)}
                        onValueChange={(v) =>
                          updateTaskData(currentIndex, { storyPoints: Number(v) })
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIBONACCI.map((sp) => (
                            <SelectItem key={sp} value={String(sp)}>
                              {sp}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Description — inline editable */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    {editingDesc ? (
                      <Textarea
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        onBlur={saveDesc}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingDesc(false);
                          }
                        }}
                        rows={6}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3 cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={startEditDesc}
                      >
                        {current.task.description}
                      </div>
                    )}
                  </div>

                  {/* Acceptance Criteria — individual items */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Acceptance Criteria</Label>
                      <Badge variant="secondary" className="text-xs">
                        {current.task.acceptanceCriteria.length} criteria
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      {current.task.acceptanceCriteria.map((ac, acIdx) => (
                        <div key={acIdx} className="flex items-start gap-2 group/ac py-0.5">
                          <div className="size-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                          {editingAcIndex === acIdx ? (
                            <Input
                              value={acEditValue}
                              onChange={(e) => setAcEditValue(e.target.value)}
                              onBlur={saveAc}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAc();
                                if (e.key === 'Escape') setEditingAcIndex(null);
                              }}
                              autoFocus
                              className="h-7 text-sm"
                            />
                          ) : (
                            <span
                              className="flex-1 text-sm cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50"
                              onClick={() => startEditAc(acIdx)}
                            >
                              {ac}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 opacity-0 group-hover/ac:opacity-100 shrink-0"
                            onClick={() => removeAc(acIdx)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {addingCriteria ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="size-1.5 shrink-0" />
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-fit gap-1 text-muted-foreground -ml-2 mt-1"
                        onClick={() => setAddingCriteria(true)}
                      >
                        <Plus className="size-3.5" />
                        Add criterion
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Bottom action bar */}
            {!isComplete && (
              <div className="border-t px-6 py-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Back
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSkip}>
                    <SkipForward className="size-4 mr-1" />
                    Skip
                  </Button>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            onClick={handleApprove}
                            disabled={createTask.isPending || !hasValidCriteria}
                          >
                            <Check className="size-4 mr-1" />
                            Approve
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!hasValidCriteria && (
                        <TooltipContent>
                          At least one acceptance criterion is required.
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApproveAll}
                    disabled={createTask.isPending}
                  >
                    <CheckCheck className="size-4 mr-1" />
                    Approve All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
