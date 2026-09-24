import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { FIELD_DEFS, isFieldVisible, type FieldConfig, type FieldKey } from '@/lib/fieldConfig';
import { toast } from 'sonner';

export function ConfigureFieldsDialog({
  open,
  onOpenChange,
  projectId,
  fieldConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  fieldConfig?: FieldConfig | null;
}) {
  const update = useUpdateProject(projectId);

  // local toggle state, seeded from saved config; missing key => visible
  const seed = useMemo(() => {
    const s = {} as Record<FieldKey, boolean>;
    for (const def of FIELD_DEFS) s[def.key] = isFieldVisible(fieldConfig, def.key);
    return s;
  }, [fieldConfig]);

  const [visible, setVisible] = useState<Record<FieldKey, boolean>>(seed);

  // reset local state to saved config whenever the dialog (re)opens
  useEffect(() => {
    if (open) setVisible(seed);
  }, [open, seed]);

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Fields</DialogTitle>
          <DialogDescription>
            Hidden fields won't show on task create &amp; detail forms. Existing task data is kept.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="py-1">
          <div className="flex justify-end pb-1">
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {allOn ? 'Hide all' : 'Show all'}
            </Button>
          </div>
          <div className="divide-y">
            {FIELD_DEFS.map((def) => (
              <div key={def.key} className="flex items-center justify-between py-2.5">
                <Label htmlFor={`field-${def.key}`} className="flex items-center gap-2 font-normal">
                  {def.label}
                  {def.required && <Badge>Required</Badge>}
                </Label>
                <Switch
                  id={`field-${def.key}`}
                  checked={def.required || visible[def.key]}
                  disabled={def.required}
                  onCheckedChange={(v) => setVisible((prev) => ({ ...prev, [def.key]: v }))}
                />
              </div>
            ))}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" />}
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
