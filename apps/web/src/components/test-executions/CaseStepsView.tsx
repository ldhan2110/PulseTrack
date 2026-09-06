import { ListChecks, ShieldCheck, Target, CheckCircle2 } from 'lucide-react';
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
  const sortedSteps = [...steps].sort((a, b) => a.position - b.position);

  return (
    <div className={`flex flex-col ${compact ? 'gap-5 p-4 text-xs' : 'gap-7 p-6 text-sm'}`}>
      {/* Header */}
      <div className="flex flex-col gap-2 border-b pb-4">
        {testCaseKey && (
          <span className="w-fit rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-mono font-medium text-primary">
            {testCaseKey}
          </span>
        )}
        <h2 className={`font-semibold tracking-tight text-foreground ${compact ? 'text-sm' : 'text-xl'}`}>
          {title}
        </h2>
      </div>

      {/* Preconditions */}
      {preconditions && (
        <section className="flex flex-col gap-2.5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-3.5 text-amber-500" />
            Preconditions
          </h4>
          <p className="relative overflow-hidden whitespace-pre-wrap rounded-lg border bg-amber-50/40 px-4 py-3 leading-relaxed text-foreground/80 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-amber-400 dark:bg-amber-900/10">
            {preconditions}
          </p>
        </section>
      )}

      {/* Steps */}
      {sortedSteps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="size-3.5 text-primary" />
            Steps
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {sortedSteps.length}
            </span>
          </h4>
          <ol className="relative flex flex-col gap-2.5 before:absolute before:bottom-5 before:left-[15px] before:top-5 before:w-px before:bg-border">
            {sortedSteps.map((step, i) => (
              <li
                key={step.id}
                className="group relative flex gap-3.5 rounded-xl border bg-card px-3.5 py-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm ring-4 ring-card transition-transform group-hover:scale-110">
                  {step.position}
                </span>
                <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                  <p className="font-medium leading-snug text-foreground">{step.action}</p>
                  {step.expectedResult && (
                    <p className="flex items-start gap-1.5 rounded-md bg-green-50/60 px-2 py-1 text-green-700 dark:bg-green-900/15 dark:text-green-400">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                      <span className="leading-snug">{step.expectedResult}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Expected Result */}
      {expectedResult && (
        <section className="flex flex-col gap-2.5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="size-3.5 text-green-500" />
            Expected Result
          </h4>
          <p className="relative overflow-hidden whitespace-pre-wrap rounded-lg border bg-green-50/40 px-4 py-3 leading-relaxed text-foreground/80 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-green-500 dark:bg-green-900/10">
            {expectedResult}
          </p>
        </section>
      )}
    </div>
  );
}
