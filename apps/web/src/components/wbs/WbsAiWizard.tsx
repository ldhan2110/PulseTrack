import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WizardScopeStep, type ScopeData } from './wizard/WizardScopeStep';
import { WizardTeamStep, type TeamData } from './wizard/WizardTeamStep';
import { WizardConstraintsStep, type ConstraintsData } from './wizard/WizardConstraintsStep';
import { WizardReviewStep } from './wizard/WizardReviewStep';
import { WizardPreviewChat } from './wizard/WizardPreviewChat';
import { useAiWbsGeneration } from '@/hooks/useAiWbsGeneration';
import { useBulkCreateWbs } from '@/hooks/useWbs';

interface WbsAiWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const STEPS = [
  { label: 'Scope' },
  { label: 'Team' },
  { label: 'Constraints' },
  { label: 'Generate' },
];

export function WbsAiWizard({ open, onClose, projectId }: WbsAiWizardProps) {
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<ScopeData>({ features: [], instructions: '', file: null });
  const [team, setTeam] = useState<TeamData>({ teamSize: 5, roles: [] });
  const [constraints, setConstraints] = useState<ConstraintsData>({
    projectStartDate: new Date().toISOString().slice(0, 10),
    targetEndDate: '',
    methodology: 'agile',
    sprintDuration: '2-weeks',
  });
  const [scanCodebase, setScanCodebase] = useState(false);
  const [generatedPhases, setGeneratedPhases] = useState<any[] | null>(null);

  const aiGen = useAiWbsGeneration(projectId);
  const bulkCreate = useBulkCreateWbs(projectId);

  // Transition to preview mode when generation completes
  useEffect(() => {
    if (aiGen.isCompleted && !generatedPhases && aiGen.phases.length > 0) {
      setGeneratedPhases(aiGen.phases);
    }
  }, [aiGen.isCompleted, aiGen.phases, generatedPhases]);

  const handleGenerate = () => {
    const formData = new FormData();
    if (scope.file) {
      formData.append('document', scope.file);
    }
    if (scope.features.length > 0) {
      formData.append('features', JSON.stringify(scope.features));
    }
    if (scope.instructions) formData.append('instructions', scope.instructions);
    if (team.teamSize) formData.append('teamSize', String(team.teamSize));
    if (team.roles.length > 0) formData.append('teamRoles', JSON.stringify(team.roles));
    formData.append('projectStartDate', constraints.projectStartDate);
    formData.append('targetEndDate', constraints.targetEndDate);
    formData.append('methodology', constraints.methodology);
    formData.append('sprintDuration', constraints.sprintDuration);
    if (scanCodebase) formData.append('scanCodebase', 'true');
    aiGen.generate.mutate(formData);
  };

  const handleImport = () => {
    if (!generatedPhases) return;
    bulkCreate.mutate(
      { phases: generatedPhases },
      {
        onSuccess: () => {
          handleClose();
        },
      },
    );
  };

  const handleClose = () => {
    setStep(0);
    setScope({ features: [], instructions: '', file: null });
    setTeam({ teamSize: 5, roles: [] });
    setConstraints({
      projectStartDate: new Date().toISOString().slice(0, 10),
      targetEndDate: '',
      methodology: 'agile',
      sprintDuration: '2-weeks',
    });
    setScanCodebase(false);
    setGeneratedPhases(null);
    aiGen.reset();
    onClose();
  };

  const canProceed = (() => {
    if (step === 0) return scope.features.length > 0 || scope.file !== null;
    if (step === 1) return team.teamSize > 0;
    if (step === 2) return !!constraints.projectStartDate;
    return true;
  })();

  const isPreviewMode = generatedPhases !== null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        className={
          isPreviewMode
            ? 'max-w-5xl h-[80vh] flex flex-col p-0 gap-0'
            : 'w-[50%] flex flex-col gap-0 p-0'
        }
        style={{ maxWidth: "none" }}
      >
        {isPreviewMode ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <DialogTitle>AI WBS — Review &amp; Refine</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <WizardPreviewChat
                projectId={projectId}
                phases={generatedPhases}
                onPhasesUpdate={setGeneratedPhases}
                onImport={handleImport}
                onCancel={handleClose}
                isImporting={bulkCreate.isPending}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <DialogTitle>AI WBS Wizard</DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center px-6 py-4 shrink-0">
              {STEPS.map((s, i) => (
                <div key={s.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={[
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                        i === step
                          ? 'bg-primary text-primary-foreground'
                          : i < step
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={[
                        'text-xs',
                        i === step
                          ? 'text-primary font-medium'
                          : i < step
                          ? 'text-primary/80'
                          : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={[
                        'h-px flex-1 mx-2 mb-5',
                        i < step ? 'bg-primary/40' : 'bg-muted',
                      ].join(' ')}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {step === 0 && (
                <WizardScopeStep data={scope} onChange={setScope} />
              )}
              {step === 1 && (
                <WizardTeamStep data={team} onChange={setTeam} />
              )}
              {step === 2 && (
                <WizardConstraintsStep data={constraints} onChange={setConstraints} />
              )}
              {step === 3 && (
                <WizardReviewStep
                  scope={scope}
                  team={team}
                  constraints={constraints}
                  scanCodebase={scanCodebase}
                  onScanCodebaseChange={setScanCodebase}
                  onGenerate={handleGenerate}
                  isGenerating={aiGen.isLoading}
                  rawText={aiGen.rawText}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between border-t border-border px-6 py-4 shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}
              >
                {step === 0 ? (
                  'Cancel'
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </>
                )}
              </Button>
              {step < STEPS.length - 1 && (
                <Button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
