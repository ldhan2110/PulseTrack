import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, X, Plus, List } from 'lucide-react';

interface ReproStep {
  position: number;
  content: string;
}

interface ReproStepsListProps {
  steps: ReproStep[];
  onChange: (steps: ReproStep[]) => void;
  readOnly?: boolean;
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s*|[-•*]\s*)/, '').trim())
    .filter(Boolean);
}

export function ReproStepsList({ steps, onChange, readOnly }: ReproStepsListProps) {
  const [newStep, setNewStep] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const addStep = () => {
    if (!newStep.trim()) return;
    const updated = [...steps, { position: steps.length, content: newStep.trim() }];
    onChange(reindex(updated));
    setNewStep('');
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    onChange(reindex(updated));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(reindex(updated));
  };

  const updateStep = (index: number, content: string) => {
    const updated = steps.map((s, i) => (i === index ? { ...s, content } : s));
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addStep();
    }
  };

  const enterBulkMode = () => {
    if (steps.length > 0) {
      setBulkText(steps.map((s) => s.content).join('\n'));
    }
    setBulkMode(true);
  };

  const handleBulkSubmit = () => {
    const lines = parseLines(bulkText);
    if (lines.length === 0) return;
    const newSteps: ReproStep[] = lines.map((content, i) => ({ position: i, content }));
    onChange(newSteps);
    setBulkText('');
    setBulkMode(false);
  };

  if (bulkMode && !readOnly) {
    return (
      <div className="flex flex-col gap-2">
        {steps.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Editing {steps.length} step{steps.length !== 1 ? 's' : ''} — submit will replace all
          </p>
        )}
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Type or paste steps, one per line:\n1. Open the app\n2. Navigate to settings\n3. Click save"}
          rows={6}
          autoFocus
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleBulkSubmit}
            disabled={!bulkText.trim()}
            className="text-xs gap-1"
          >
            <Plus className="size-3" />
            Save {parseLines(bulkText).length || ''} Step{parseLines(bulkText).length !== 1 ? 's' : ''}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setBulkText(''); setBulkMode(false); }}
            className="text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            {index + 1}
          </div>
          {readOnly ? (
            <span className="text-sm flex-1">{step.content}</span>
          ) : (
            <Input
              value={step.content}
              onChange={(e) => updateStep(index, e.target.value)}
              className="flex-1 h-8 text-sm"
            />
          )}
          {!readOnly && (
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => moveStep(index, -1)}
                disabled={index === 0}
              >
                <ArrowUp className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => moveStep(index, 1)}
                disabled={index === steps.length - 1}
              >
                <ArrowDown className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-destructive hover:text-destructive"
                onClick={() => removeStep(index)}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center size-6 rounded-full border border-dashed border-primary text-primary text-xs shrink-0">
              <Plus className="size-3" />
            </div>
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add step..."
              className="flex-1 h-8 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addStep}
              disabled={!newStep.trim()}
              className="text-xs"
            >
              Add
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={enterBulkMode}
            className="self-start text-xs gap-1"
          >
            <List className="size-3" />
            Bulk Add
          </Button>
        </div>
      )}
    </div>
  );
}

function reindex(steps: ReproStep[]): ReproStep[] {
  return steps.map((s, i) => ({ ...s, position: i }));
}
