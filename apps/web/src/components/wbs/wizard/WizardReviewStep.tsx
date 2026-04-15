import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScopeData } from './WizardScopeStep';
import type { TeamData } from './WizardTeamStep';
import type { ConstraintsData } from './WizardConstraintsStep';

interface WizardReviewStepProps {
  scope: ScopeData;
  team: TeamData;
  constraints: ConstraintsData;
  onGenerate: () => void;
  isGenerating: boolean;
  rawText: string;
}

const METHODOLOGY_LABELS: Record<ConstraintsData['methodology'], string> = {
  agile: 'Agile',
  waterfall: 'Waterfall',
  hybrid: 'Hybrid',
};

const SPRINT_DURATION_LABELS: Record<ConstraintsData['sprintDuration'], string> = {
  '1-week': '1-week sprints',
  '2-weeks': '2-week sprints',
  '3-weeks': '3-week sprints',
};

export function WizardReviewStep({
  scope,
  team,
  constraints,
  onGenerate,
  isGenerating,
  rawText,
}: WizardReviewStepProps) {
  const showSprintDuration = constraints.methodology === 'agile' || constraints.methodology === 'hybrid';

  const timelineLabel = (() => {
    if (constraints.projectStartDate && constraints.targetEndDate) {
      return `${constraints.projectStartDate} → ${constraints.targetEndDate}`;
    }
    if (constraints.projectStartDate) {
      return `Starting ${constraints.projectStartDate}`;
    }
    return 'No dates set';
  })();

  if (isGenerating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" />
          <span className="text-sm font-medium">Generating WBS...</span>
        </div>
        {rawText && (
          <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed">
            <code>{rawText}</code>
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-4">
        <h3 className="text-sm font-semibold">Summary</h3>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Scope */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope</p>
            <p>
              {scope.features.length > 0
                ? `${scope.features.length} feature${scope.features.length !== 1 ? 's' : ''}`
                : 'No features added'}
            </p>
            {scope.file && (
              <p className="text-xs text-muted-foreground">+ file: {scope.file.name}</p>
            )}
          </div>

          {/* Team */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team</p>
            <p>
              {team.teamSize} member{team.teamSize !== 1 ? 's' : ''}
              {team.roles.length > 0 && `, ${team.roles.length} role${team.roles.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeline</p>
            <p>{timelineLabel}</p>
          </div>

          {/* Methodology */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Methodology</p>
            <p>
              {METHODOLOGY_LABELS[constraints.methodology]}
              {showSprintDuration && (
                <span className="text-muted-foreground"> · {SPRINT_DURATION_LABELS[constraints.sprintDuration]}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <Button type="button" className="w-full gap-2" onClick={onGenerate}>
        <Sparkles className="h-4 w-4" />
        Generate WBS
      </Button>
    </div>
  );
}
