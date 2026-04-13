import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, X, Plus } from 'lucide-react';

interface ReproStep {
  position: number;
  content: string;
}

interface ReproStepsListProps {
  steps: ReproStep[];
  onChange: (steps: ReproStep[]) => void;
  readOnly?: boolean;
}

export function ReproStepsList({ steps, onChange, readOnly }: ReproStepsListProps) {
  const [newStep, setNewStep] = useState('');

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
      )}
    </div>
  );
}

function reindex(steps: ReproStep[]): ReproStep[] {
  return steps.map((s, i) => ({ ...s, position: i }));
}
