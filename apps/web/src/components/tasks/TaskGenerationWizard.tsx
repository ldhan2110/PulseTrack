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
  Check,
  SkipForward,
  Pencil,
  ChevronLeft,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { useCreateTask } from '@/hooks/useTasks';
import type { GeneratedTask, Priority } from '@/lib/types';

type TaskStatus = 'pending' | 'approved' | 'skipped';

interface FlatTask {
  task: GeneratedTask;
  parentIndex: number | null; // null = top-level
  status: TaskStatus;
  createdTaskId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: GeneratedTask[];
  projectId: string;
  onComplete: () => void;
}

export function TaskGenerationWizard({ open, onOpenChange, tasks, projectId, onComplete }: Props) {
  const createTask = useCreateTask(projectId);

  // Flatten task tree into ordered list: parent → sub1 → sub2 → parent → sub1 → ...
  const initialFlat = useMemo(() => {
    const flat: FlatTask[] = [];
    tasks.forEach((task, i) => {
      flat.push({ task, parentIndex: null, status: 'pending' });
      if (task.subTasks) {
        task.subTasks.forEach((sub) => {
          flat.push({ task: sub, parentIndex: i, status: 'pending' });
        });
      }
    });
    return flat;
  }, [tasks]);

  const [flatTasks, setFlatTasks] = useState<FlatTask[]>(initialFlat);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<GeneratedTask | null>(null);

  const current = flatTasks[currentIndex];
  const isComplete = currentIndex >= flatTasks.length;

  // Find the parent's created task ID for sub-tasks
  const getParentTaskId = useCallback(
    (flat: FlatTask[], index: number): string | undefined => {
      const item = flat[index];
      if (item.parentIndex === null) return undefined;
      // Find the parent in the flat list
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

  const moveNext = useCallback(() => {
    let next = currentIndex + 1;
    // If we just skipped a parent, skip its sub-tasks too
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
    setIsEditing(false);
    setEditValues(null);
  }, [currentIndex, flatTasks]);

  const handleApprove = async () => {
    const taskData = isEditing && editValues ? editValues : current.task;
    const parentId = current.parentIndex !== null ? getParentTaskId(flatTasks, currentIndex) : undefined;

    // Skip sub-task if parent was skipped (no parentId)
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
        acceptanceCriteria: taskData.acceptanceCriteria,
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

  const handleEdit = () => {
    setIsEditing(true);
    setEditValues({ ...current.task });
  };

  const handleApproveAll = async () => {
    for (let i = currentIndex; i < flatTasks.length; i++) {
      if (flatTasks[i].status !== 'pending') continue;
      const task = flatTasks[i].task;
      const parentId = flatTasks[i].parentIndex !== null ? getParentTaskId(flatTasks, i) : undefined;

      if (flatTasks[i].parentIndex !== null && !parentId) continue;

      try {
        const created = await createTask.mutateAsync({
          title: task.title,
          description: task.description,
          acceptanceCriteria: task.acceptanceCriteria,
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
      setCurrentIndex(currentIndex - 1);
      setIsEditing(false);
      setEditValues(null);
    }
  };

  // Counts
  const approved = flatTasks.filter((t) => t.status === 'approved').length;
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
              {currentIndex + 1} / {flatTasks.length}
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
                        setIsEditing(false);
                        setEditValues(null);
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
                /* Completion screen */
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
                /* Task detail */
                <div className="space-y-4">
                  {current.parentIndex !== null && (
                    <Badge variant="secondary" className="text-xs">Sub-task</Badge>
                  )}

                  {/* Title */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    {isEditing ? (
                      <Input
                        value={editValues?.title ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) => prev ? { ...prev, title: e.target.value } : prev)
                        }
                        maxLength={200}
                      />
                    ) : (
                      <h3 className="text-base font-semibold">{current.task.title}</h3>
                    )}
                  </div>

                  <div className="flex gap-4">
                    {/* Priority */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      {isEditing ? (
                        <Select
                          value={editValues?.priority ?? 'MEDIUM'}
                          onValueChange={(v) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, priority: v as GeneratedTask['priority'] } : prev,
                            )
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
                      ) : (
                        <Badge className={PRIORITY_COLORS[current.task.priority]}>
                          {current.task.priority}
                        </Badge>
                      )}
                    </div>

                    {/* Story Points */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Story Points</Label>
                      {isEditing ? (
                        <Select
                          value={String(editValues?.storyPoints ?? 3)}
                          onValueChange={(v) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, storyPoints: Number(v) } : prev,
                            )
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 5, 8, 13].map((sp) => (
                              <SelectItem key={sp} value={String(sp)}>
                                {sp}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm font-medium">{current.task.storyPoints} pts</div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Description */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    {isEditing ? (
                      <Textarea
                        value={editValues?.description ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) =>
                            prev ? { ...prev, description: e.target.value } : prev,
                          )
                        }
                        rows={6}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                        {current.task.description}
                      </div>
                    )}
                  </div>

                  {/* Acceptance Criteria */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Acceptance Criteria</Label>
                    {isEditing ? (
                      <Textarea
                        value={editValues?.acceptanceCriteria ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) =>
                            prev ? { ...prev, acceptanceCriteria: e.target.value } : prev,
                          )
                        }
                        rows={6}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                        {current.task.acceptanceCriteria}
                      </div>
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

                  {!isEditing && current.status === 'pending' && (
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                      <Pencil className="size-4 mr-1" />
                      Edit & Approve
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={createTask.isPending}
                  >
                    <Check className="size-4 mr-1" />
                    {isEditing ? 'Save & Approve' : 'Approve'}
                  </Button>

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
