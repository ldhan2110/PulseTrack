// apps/web/src/components/tasks/TaskProgressBar.tsx
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TaskProgressBarProps {
  value: number;
  editable?: boolean;
  onSave?: (value: number) => void;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function TaskProgressBar({
  value,
  editable = false,
  onSave,
  showLabel = true,
  size = 'sm',
}: TaskProgressBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const barHeight = size === 'sm' ? 'h-1' : 'h-2';
  const barColor = value >= 100 ? 'bg-blue-500' : 'bg-green-500';

  const handleSave = () => {
    const clamped = Math.max(0, Math.min(100, draft));
    setEditing(false);
    if (clamped !== value && onSave) {
      onSave(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing && editable) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="flex-1 h-2 accent-green-500"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-14 rounded border border-input bg-background px-2 py-0.5 text-xs text-center"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        editable && 'cursor-pointer',
      )}
      onClick={() => editable && setEditing(true)}
      title={editable ? 'Click to edit progress' : `${value}%`}
    >
      <div className={cn('flex-1 rounded-full bg-muted overflow-hidden', barHeight)}>
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[2rem] text-right">
          {value}%
        </span>
      )}
    </div>
  );
}

/**
 * Compute averaged progress for a parent task from its children.
 * Returns 0 if no children exist.
 */
export function getParentProgress(children: { progress?: number }[]): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((acc, c) => acc + (c.progress ?? 0), 0);
  return Math.round(sum / children.length);
}
