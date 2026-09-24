import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useUpdateProject } from '@/hooks/useProjects';
import { api } from '@/lib/api';
import { FIELD_DEFS, isFieldVisible, type FieldConfig, type FieldKey } from '@/lib/fieldConfig';
import { FieldValueEditor, type FieldValueRow } from './FieldValueEditor';
import { toast } from 'sonner';

// Fields whose values are managed by a dedicated endpoint (get an inline editor).
const VALUE_BACKED: Partial<Record<FieldKey, { addLabel: string; noun: string }>> = {
  taskType: { addLabel: 'Add ticket type', noun: 'ticket type' },
  taskCategory: { addLabel: 'Add task type', noun: 'task type' },
};

export function ConfigureFieldsDialog({
  open,
  onOpenChange,
  projectId,
  fieldConfig,
  canManage = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  fieldConfig?: FieldConfig | null;
  canManage?: boolean;
}) {
  const qc = useQueryClient();
  const update = useUpdateProject(projectId);

  // local toggle state, seeded from saved config; missing key => visible
  const seed = useMemo(() => {
    const s = {} as Record<FieldKey, boolean>;
    for (const def of FIELD_DEFS) s[def.key] = isFieldVisible(fieldConfig, def.key);
    return s;
  }, [fieldConfig]);

  const [visible, setVisible] = useState<Record<FieldKey, boolean>>(seed);
  const [expanded, setExpanded] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [dirty, setDirty] = useState<Partial<Record<FieldKey, boolean>>>({});

  // reset local state to saved config whenever the dialog (re)opens
  useEffect(() => {
    if (open) {
      setVisible(seed);
      setExpanded({});
      setDirty({});
    }
  }, [open, seed]);

  // Value-backed data + save mutations (one pair per value-backed field).
  const taskTypesQuery = useQuery({
    queryKey: ['task-types', projectId],
    queryFn: () => api.getTaskTypes(projectId),
    enabled: !!projectId && open,
  });
  const taskCategoriesQuery = useQuery({
    queryKey: ['task-categories', projectId],
    queryFn: () => api.getTaskCategories(projectId),
    enabled: !!projectId && open,
  });

  const saveTaskTypes = useMutation({
    mutationFn: (rows: FieldValueRow[]) => api.setTaskTypes(projectId, rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-types', projectId] });
      toast.success('Ticket types saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const saveTaskCategories = useMutation({
    mutationFn: (rows: FieldValueRow[]) => api.setTaskCategories(projectId, rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-categories', projectId] });
      toast.success('Task types saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editorFor = (key: FieldKey) =>
    key === 'taskType'
      ? { query: taskTypesQuery, mutation: saveTaskTypes }
      : { query: taskCategoriesQuery, mutation: saveTaskCategories };

  const setFieldDirty = useCallback(
    (key: FieldKey, isDirty: boolean) =>
      setDirty((prev) => (prev[key] === isDirty ? prev : { ...prev, [key]: isDirty })),
    [],
  );

  const anyValueDirty = Object.values(dirty).some(Boolean);

  // required fields ignored — they can't be hidden
  const allOn = FIELD_DEFS.every((d) => d.required || visible[d.key]);

  const toggleAll = () => {
    const next = {} as Record<FieldKey, boolean>;
    for (const def of FIELD_DEFS) next[def.key] = def.required ? true : !allOn;
    setVisible(next);
  };

  const handleSave = () => {
    // store only hidden keys (default is visible) — keeps the blob small
    const next: FieldConfig = {};
    for (const def of FIELD_DEFS) {
      if (!def.required && !visible[def.key]) next[def.key] = false;
    }
    update.mutate(
      { fieldConfig: next },
      {
        onSuccess: () => onOpenChange(false),
        onError: () => toast.error("Couldn't save field configuration. Try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Fields</DialogTitle>
          <DialogDescription>
            Hidden fields won't show on task create &amp; detail forms. Existing task data is kept.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[60vh] overflow-y-auto py-1">
          <div className="flex justify-end pb-1">
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {allOn ? 'Hide all' : 'Show all'}
            </Button>
          </div>
          <div className="divide-y">
            {FIELD_DEFS.map((def) => {
              const vb = VALUE_BACKED[def.key];
              const isExpanded = !!expanded[def.key];
              const editor = vb ? editorFor(def.key) : null;
              const count = editor?.query.data?.length ?? 0;
              return (
                <div key={def.key} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {vb ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [def.key]: !prev[def.key] }))
                          }
                          className="flex items-center gap-2 text-left"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                          <span className="font-normal">{def.label}</span>
                          {def.required && <Badge>Required</Badge>}
                          <Badge variant="secondary" className="font-normal">
                            {count} values
                          </Badge>
                        </button>
                      ) : (
                        <Label
                          htmlFor={`field-${def.key}`}
                          className="flex items-center gap-2 font-normal"
                        >
                          {def.label}
                          {def.required && <Badge>Required</Badge>}
                        </Label>
                      )}
                    </div>
                    <Switch
                      id={`field-${def.key}`}
                      checked={def.required || visible[def.key]}
                      disabled={def.required}
                      onCheckedChange={(v) => setVisible((prev) => ({ ...prev, [def.key]: v }))}
                    />
                  </div>

                  {vb && isExpanded && editor && (
                    <div className="pt-2">
                      <FieldValueEditor
                        items={editor.query.data ?? []}
                        onSave={(rows) => editor.mutation.mutate(rows)}
                        saving={editor.mutation.isPending}
                        addLabel={vb.addLabel}
                        noun={vb.noun}
                        canManage={canManage}
                        onDirtyChange={(d) => setFieldDirty(def.key, d)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter className="flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-end">
          {anyValueDirty && (
            <span className="text-xs text-destructive sm:mr-auto">
              Save or discard value edits before saving visibility.
            </span>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={update.isPending || anyValueDirty}>
              {update.isPending && <Loader2 className="animate-spin" />}
              {update.isPending ? 'Saving…' : 'Save visibility'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
