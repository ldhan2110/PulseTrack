import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

export interface TestStep {
  position: number;
  action: string;
  expectedResult: string;
}

interface StepsBuilderProps {
  steps: TestStep[];
  onChange: (steps: TestStep[]) => void;
}

function reindex(steps: TestStep[]): TestStep[] {
  return steps.map((s, i) => ({ ...s, position: i }));
}

export function StepsBuilder({ steps, onChange }: StepsBuilderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const addStep = () => {
    const updated = [...steps, { position: steps.length, action: '', expectedResult: '' }];
    onChange(reindex(updated));

    // Focus the new action input after render
    requestAnimationFrame(() => {
      const inputs = containerRef.current?.querySelectorAll<HTMLInputElement>(
        'input[data-field="action"]',
      );
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    onChange(reindex(updated));
  };

  const updateStep = (index: number, field: 'action' | 'expectedResult', value: string) => {
    const updated = steps.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(updated);
  };

  const handleExpectedResultKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Tab' && !e.shiftKey && index === steps.length - 1) {
      e.preventDefault();
      addStep();
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0 mt-1.5">
            {index + 1}
          </div>
          <div className="flex-1 flex gap-2">
            <Input
              data-field="action"
              value={step.action}
              onChange={(e) => updateStep(index, 'action', e.target.value)}
              placeholder="Action"
              className="flex-1 h-8 text-sm"
            />
            <Input
              data-field="expectedResult"
              value={step.expectedResult}
              onChange={(e) => updateStep(index, 'expectedResult', e.target.value)}
              onKeyDown={(e) => handleExpectedResultKeyDown(e, index)}
              placeholder="Expected result"
              className="flex-1 h-8 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-destructive hover:text-destructive mt-1.5"
            onClick={() => removeStep(index)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addStep}
        className="self-start text-xs gap-1"
      >
        <Plus className="size-3" />
        Add Step
      </Button>
    </div>
  );
}
