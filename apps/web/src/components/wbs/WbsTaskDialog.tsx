import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateWbsPhase, useUpdateWbsPhase,
  useCreateWbsTask, useUpdateWbsTask,
  useCreateWbsSubtask, useUpdateWbsSubtask,
} from '@/hooks/useWbs';

interface DialogMode {
  type: 'phase' | 'task' | 'subtask';
  parentId?: string;
  editItem?: any;
}

interface WbsTaskDialogProps {
  mode: DialogMode;
  projectId: string;
  onClose: () => void;
}

export function WbsTaskDialog({ mode, projectId, onClose }: WbsTaskDialogProps) {
  const isEdit = !!mode.editItem;
  const [title, setTitle] = useState(mode.editItem?.title ?? '');
  const [description, setDescription] = useState(mode.editItem?.description ?? '');
  const [planStart, setPlanStart] = useState(mode.editItem?.planStart?.slice(0, 10) ?? '');
  const [planEnd, setPlanEnd] = useState(mode.editItem?.planEnd?.slice(0, 10) ?? '');
  const [actualStart, setActualStart] = useState(mode.editItem?.actualStart?.slice(0, 10) ?? '');
  const [actualEnd, setActualEnd] = useState(mode.editItem?.actualEnd?.slice(0, 10) ?? '');
  const [progress, setProgress] = useState<string>(String(mode.editItem?.progress ?? 0));

  const createPhase = useCreateWbsPhase(projectId);
  const updatePhase = useUpdateWbsPhase(projectId);
  const createTask = useCreateWbsTask(projectId);
  const updateTask = useUpdateWbsTask(projectId);
  const createSubtask = useCreateWbsSubtask(projectId);
  const updateSubtask = useUpdateWbsSubtask(projectId);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const base = { title: title.trim(), description: description.trim() || undefined };

    if (mode.type === 'phase') {
      if (isEdit) {
        updatePhase.mutate({ phaseId: mode.editItem.id, data: base }, { onSuccess: onClose });
      } else {
        createPhase.mutate(base, { onSuccess: onClose });
      }
    } else if (mode.type === 'task') {
      const dates = {
        ...base,
        ...(planStart ? { planStart } : {}),
        ...(planEnd ? { planEnd } : {}),
        ...(isEdit && actualStart ? { actualStart } : {}),
        ...(isEdit && actualEnd ? { actualEnd } : {}),
        ...(isEdit ? { progress: Number(progress) } : {}),
      };
      if (isEdit) {
        updateTask.mutate(
          { phaseId: mode.editItem.phaseId, taskId: mode.editItem.id, data: dates },
          { onSuccess: onClose },
        );
      } else {
        createTask.mutate({ phaseId: mode.parentId!, data: dates }, { onSuccess: onClose });
      }
    } else {
      const dates = {
        ...base,
        ...(planStart ? { planStart } : {}),
        ...(planEnd ? { planEnd } : {}),
        ...(isEdit && actualStart ? { actualStart } : {}),
        ...(isEdit && actualEnd ? { actualEnd } : {}),
        ...(isEdit ? { progress: Number(progress) } : {}),
      };
      if (isEdit) {
        updateSubtask.mutate(
          { taskId: mode.editItem.taskId, subtaskId: mode.editItem.id, data: dates },
          { onSuccess: onClose },
        );
      } else {
        createSubtask.mutate({ taskId: mode.parentId!, data: dates }, { onSuccess: onClose });
      }
    }
  };

  const titleLabel = mode.type === 'phase' ? 'Phase' : mode.type === 'task' ? 'Task' : 'Subtask';
  const showDates = mode.type !== 'phase';
  const showActuals = isEdit && mode.type !== 'phase';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${titleLabel}` : `New ${titleLabel}`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${titleLabel} title`} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" rows={2} />
            </div>
            {showDates && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Plan Start</label>
                  <Input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Plan End</label>
                  <Input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
                </div>
              </div>
            )}
            {showActuals && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Actual Start</label>
                    <Input type="date" value={actualStart} onChange={(e) => setActualStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Actual End</label>
                    <Input type="date" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Progress (%)</label>
                  <Input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
