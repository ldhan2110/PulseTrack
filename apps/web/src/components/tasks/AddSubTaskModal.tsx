import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TaskTypeOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface AddSubTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, taskTypeId: string) => void;
  taskTypes: TaskTypeOption[];
}

export function AddSubTaskModal({ open, onOpenChange, onSave, taskTypes }: AddSubTaskModalProps) {
  const [title, setTitle] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const activeTaskTypes = taskTypes.filter((t) => t.isActive);

  useEffect(() => {
    if (open) {
      setTitle('');
      setTaskTypeId('');
    }
  }, [open]);

  const handleSave = () => {
    if (!title.trim() || !taskTypeId) return;
    onSave(title.trim(), taskTypeId);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Sub-task</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <label className="text-xs text-muted-foreground mb-1 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sub-task title"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <label className="text-xs text-muted-foreground mt-3 mb-1 block">Task Type</label>
          <Select value={taskTypeId} onValueChange={setTaskTypeId}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {activeTaskTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim() || !taskTypeId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
