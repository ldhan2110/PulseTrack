import type { TestCaseStep } from '@/lib/types';

interface CaseStepsViewProps {
  title: string;
  testCaseKey: string | null;
  preconditions: string | null;
  expectedResult: string | null;
  steps: TestCaseStep[];
  compact?: boolean;
}

export function CaseStepsView({
  title,
  testCaseKey,
  preconditions,
  expectedResult,
  steps,
  compact = false,
}: CaseStepsViewProps) {
  return (
    <div className={`flex flex-col gap-3 ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}`}>
      {/* Header */}
      <div>
        {testCaseKey && (
          <span className="text-xs font-mono text-muted-foreground mr-2">{testCaseKey}</span>
        )}
        <span className={`font-medium ${compact ? 'text-sm' : 'text-base'}`}>{title}</span>
      </div>

      {/* Preconditions */}
      {preconditions && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Preconditions
          </h4>
          <p className="text-muted-foreground whitespace-pre-wrap">{preconditions}</p>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Steps
          </h4>
          <div className="flex flex-col gap-1">
            {steps
              .sort((a, b) => a.position - b.position)
              .map((step) => (
                <div
                  key={step.id}
                  className="flex gap-2 rounded-md border px-3 py-2"
                >
                  <span className="text-muted-foreground font-mono shrink-0 w-5 text-right">
                    {step.position}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p>{step.action}</p>
                    {step.expectedResult && (
                      <p className="text-muted-foreground mt-0.5">
                        <span className="text-xs font-medium">Expected:</span> {step.expectedResult}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Expected Result */}
      {expectedResult && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Expected Result
          </h4>
          <p className="text-muted-foreground whitespace-pre-wrap">{expectedResult}</p>
        </div>
      )}
    </div>
  );
}
