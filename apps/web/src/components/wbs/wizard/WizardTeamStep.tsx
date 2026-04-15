import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface TeamData {
  teamSize: number;
  roles: { role: string; count: number }[];
}

interface WizardTeamStepProps {
  data: TeamData;
  onChange: (data: TeamData) => void;
}

const PRESET_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'QA Engineer',
  'DevOps',
  'Project Manager',
  'UI/UX Designer',
];

export function WizardTeamStep({ data, onChange }: WizardTeamStepProps) {
  const [roleInput, setRoleInput] = useState('');

  const addRole = (roleName: string) => {
    const trimmed = roleName.trim();
    if (!trimmed) return;
    if (data.roles.some((r) => r.role.toLowerCase() === trimmed.toLowerCase())) return;
    onChange({ ...data, roles: [...data.roles, { role: trimmed, count: 1 }] });
    setRoleInput('');
  };

  const removeRole = (index: number) => {
    onChange({ ...data, roles: data.roles.filter((_, i) => i !== index) });
  };

  const updateRoleCount = (index: number, count: number) => {
    const updated = data.roles.map((r, i) => (i === index ? { ...r, count: Math.max(1, count) } : r));
    onChange({ ...data, roles: updated });
  };

  const handleRoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRole(roleInput);
    }
  };

  const availablePresets = PRESET_ROLES.filter(
    (preset) => !data.roles.some((r) => r.role.toLowerCase() === preset.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Team Size */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Total Team Size</Label>
        <Input
          type="number"
          className="w-32 text-sm"
          min={1}
          value={data.teamSize}
          onChange={(e) => onChange({ ...data, teamSize: Math.max(1, parseInt(e.target.value) || 1) })}
        />
      </div>

      {/* Roles List */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Team Roles</Label>
        <div className="space-y-2">
          {data.roles.map((role, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="flex-1 text-sm">{role.role}</span>
              <span className="text-sm text-muted-foreground">×</span>
              <Input
                type="number"
                className="w-16 text-sm"
                min={1}
                value={role.count}
                onChange={(e) => updateRoleCount(index, parseInt(e.target.value) || 1)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeRole(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add Custom Role */}
        <div className="flex gap-2">
          <Input
            className="text-sm"
            placeholder="Add custom role..."
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={handleRoleKeyDown}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => addRole(roleInput)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preset Role Chips */}
      {availablePresets.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Quick Add</Label>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                onClick={() => addRole(preset)}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
