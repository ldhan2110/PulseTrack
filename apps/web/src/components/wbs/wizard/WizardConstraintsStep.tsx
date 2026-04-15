import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ConstraintsData {
  projectStartDate: string;
  targetEndDate: string;
  methodology: 'agile' | 'waterfall' | 'hybrid';
  sprintDuration: '1-week' | '2-weeks' | '3-weeks';
}

interface WizardConstraintsStepProps {
  data: ConstraintsData;
  onChange: (data: ConstraintsData) => void;
}

const METHODOLOGIES: { value: ConstraintsData['methodology']; label: string }[] = [
  { value: 'agile', label: 'Agile' },
  { value: 'waterfall', label: 'Waterfall' },
  { value: 'hybrid', label: 'Hybrid' },
];

const SPRINT_DURATIONS: { value: ConstraintsData['sprintDuration']; label: string }[] = [
  { value: '1-week', label: '1 week' },
  { value: '2-weeks', label: '2 weeks' },
  { value: '3-weeks', label: '3 weeks' },
];

export function WizardConstraintsStep({ data, onChange }: WizardConstraintsStepProps) {
  const showSprintDuration = data.methodology === 'agile' || data.methodology === 'hybrid';

  return (
    <div className="space-y-6">
      {/* Project Start Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Project Start Date</Label>
        <Input
          type="date"
          className="w-48 text-sm"
          value={data.projectStartDate}
          onChange={(e) => onChange({ ...data, projectStartDate: e.target.value })}
        />
      </div>

      {/* Target End Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Target End Date <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          type="date"
          className="w-48 text-sm"
          value={data.targetEndDate}
          onChange={(e) => onChange({ ...data, targetEndDate: e.target.value })}
        />
      </div>

      {/* Methodology Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Methodology</Label>
        <div className="flex gap-2">
          {METHODOLOGIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                data.methodology === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => onChange({ ...data, methodology: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint Duration (agile / hybrid only) */}
      {showSprintDuration && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sprint Duration</Label>
          <div className="flex gap-2">
            {SPRINT_DURATIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  data.sprintDuration === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => onChange({ ...data, sprintDuration: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
