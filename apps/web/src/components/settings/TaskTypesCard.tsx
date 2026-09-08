import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, RotateCcw, ChevronUp, ChevronDown, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

const MAX_VISIBLE_PILLS = 8;

interface Props {
  projectId: string;
  canManage: boolean;
}

// A row in local edit state; id is undefined for not-yet-saved types.
interface Row {
  id?: string;
  name: string;
  isActive: boolean;
}

export function TaskTypesCard({ projectId, canManage }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const { data: types = [] } = useQuery({
    queryKey: ['task-types', projectId],
    queryFn: () => api.getTaskTypes(projectId),
    enabled: !!projectId,
  });

  const activeTypes = types.filter((t) => t.isActive);

  // Reset local edit state to server state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setRows(types.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive })));
    }
  }, [open, types]);

  const save = useMutation({
    mutationFn: (payload: Row[]) => api.setTaskTypes(projectId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-types', projectId] });
      toast.success('Task types saved');
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setName = (i: number, name: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, name } : row)));
  // Persisted rows deactivate (soft-delete); unsaved rows are dropped outright.
  const removeOrToggle = (i: number) =>
    setRows((r) =>
      r.flatMap((row, idx) => {
        if (idx !== i) return [row];
        if (!row.id) return [];
        return [{ ...row, isActive: !row.isActive }];
      }),
    );
  const addRow = () => setRows((r) => [...r, { name: '', isActive: true }]);
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const activeCount = rows.filter((row) => row.isActive && row.name.trim()).length;
  const hasEmpty = rows.some((row) => row.isActive && !row.name.trim());
  const canSave = canManage && activeCount > 0 && !hasEmpty && !save.isPending;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>Task Types</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Categories available when creating a task. Required on every task.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5 mr-1" />
          Manage
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {activeTypes.length === 0 ? (
          <span className="text-xs text-muted-foreground">No task types configured.</span>
        ) : (
          <>
            {activeTypes.slice(0, MAX_VISIBLE_PILLS).map((t) => (
              <Badge key={t.id} variant="secondary" className="font-normal">
                {t.name}
              </Badge>
            ))}
            {activeTypes.length > MAX_VISIBLE_PILLS && (
              <Badge
                variant="outline"
                className="font-normal cursor-pointer hover:bg-accent"
                onClick={() => setOpen(true)}
              >
                +{activeTypes.length - MAX_VISIBLE_PILLS} more
              </Badge>
            )}
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Task Types</DialogTitle>
            <DialogDescription>
              Add, rename, reorder, or deactivate task types. At least one active type is required.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="max-h-[55vh] overflow-y-auto space-y-2">
            {rows.map((row, i) => (
              <div key={row.id ?? `new-${i}`} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={!canManage || i === 0}
                    onClick={() => move(i, -1)}
                    className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || i === rows.length - 1}
                    onClick={() => move(i, 1)}
                    className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
                <Input
                  value={row.name}
                  onChange={(e) => setName(i, e.target.value)}
                  disabled={!canManage || !row.isActive}
                  placeholder="Task type name"
                  className={`flex-1 ${!row.isActive ? 'opacity-50 line-through' : ''}`}
                />
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => removeOrToggle(i)}
                    title={!row.id ? 'Remove' : row.isActive ? 'Deactivate' : 'Restore'}
                  >
                    {!row.id ? (
                      <X className="size-4" />
                    ) : row.isActive ? (
                      <Trash2 className="size-4" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}

            {canManage && (
              <Button variant="ghost" size="sm" onClick={addRow} className="mt-1">
                <Plus className="size-4 mr-1" />
                Add task type
              </Button>
            )}

            {hasEmpty && (
              <p className="text-xs text-destructive">Active task types cannot have empty names.</p>
            )}
            {activeCount === 0 && (
              <p className="text-xs text-destructive">At least one active task type is required.</p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {canManage && (
              <Button
                disabled={!canSave}
                onClick={() => save.mutate(rows.map((r) => ({ ...r, name: r.name.trim() })))}
              >
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
