import { useEffect, useState } from 'react';
import { Plus, Trash2, RotateCcw, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A row in local edit state; id is undefined for not-yet-saved values.
export interface FieldValueRow {
  id?: string;
  name: string;
  isActive: boolean;
}

interface Item {
  id: string;
  name: string;
  isActive: boolean;
}

// Inline add/rename/reorder/deactivate editor shared by Ticket type + Task type.
// Owns its own local edit state + per-section Save; reports dirtiness upward so
// the parent can guard the visibility Save.
export function FieldValueEditor({
  items,
  onSave,
  saving,
  addLabel,
  noun,
  canManage,
  onDirtyChange,
}: {
  items: Item[];
  onSave: (rows: FieldValueRow[]) => void;
  saving: boolean;
  addLabel: string; // e.g. "Add task type"
  noun: string; // e.g. "task type" — used in messages
  canManage: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<FieldValueRow[]>([]);
  const [dirty, setDirty] = useState(false);

  // Seed from server state on mount and whenever server state changes, as long
  // as there are no unsaved local edits (don't clobber in-progress editing).
  useEffect(() => {
    if (!dirty) {
      setRows(items.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive })));
    }
  }, [items, dirty]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const markDirty = () => setDirty(true);

  const setName = (i: number, name: string) => {
    markDirty();
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, name } : row)));
  };
  // Persisted rows deactivate (soft-delete); unsaved rows are dropped outright.
  const removeOrToggle = (i: number) => {
    markDirty();
    setRows((r) =>
      r.flatMap((row, idx) => {
        if (idx !== i) return [row];
        if (!row.id) return [];
        return [{ ...row, isActive: !row.isActive }];
      }),
    );
  };
  const addRow = () => {
    markDirty();
    setRows((r) => [...r, { name: '', isActive: true }]);
  };
  const move = (i: number, dir: -1 | 1) => {
    markDirty();
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const activeCount = rows.filter((row) => row.isActive && row.name.trim()).length;
  const hasEmpty = rows.some((row) => row.isActive && !row.name.trim());
  const canSave = canManage && dirty && activeCount > 0 && !hasEmpty && !saving;

  const handleSave = () => {
    onSave(rows.map((r) => ({ ...r, name: r.name.trim() })));
    setDirty(false);
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
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
            placeholder={`${noun} name`}
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
          {addLabel}
        </Button>
      )}

      {hasEmpty && (
        <p className="text-xs text-destructive">Active values cannot have empty names.</p>
      )}
      {activeCount === 0 && (
        <p className="text-xs text-destructive">At least one active {noun} is required.</p>
      )}

      {canManage && (
        <div className="flex items-center justify-end gap-2 pt-1">
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          <Button size="sm" disabled={!canSave} onClick={handleSave}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {addLabel.replace(/^Add/, 'Save')}
          </Button>
        </div>
      )}
    </div>
  );
}
