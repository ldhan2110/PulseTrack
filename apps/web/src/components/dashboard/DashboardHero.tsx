import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ActiveSprintData } from '@/lib/types';

interface DashboardHeroProps {
  name: string;
  activeSprint: ActiveSprintData | null;
  projectPrefix: string;
}

function daysLeft(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function fmt(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DashboardHero({ name, activeSprint, projectPrefix }: DashboardHeroProps) {
  const navigate = useNavigate();

  const progress =
    activeSprint && activeSprint.totalPoints > 0
      ? Math.round((activeSprint.completedPoints / activeSprint.totalPoints) * 100)
      : 0;

  return (
    <Card className="flex flex-col gap-3 rounded-lg bg-primary px-6 py-5 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-base font-semibold">👋 Welcome back, {name}</div>
        <div className="mt-1 text-[13px] text-primary-foreground/75">
          {activeSprint
            ? `${activeSprint.name} · ${fmt(activeSprint.startDate)} – ${fmt(activeSprint.endDate)} · ${daysLeft(activeSprint.endDate)} days left`
            : "No active sprint · let's set things up"}
        </div>
      </div>

      {activeSprint ? (
        <div className="min-w-[220px]">
          <div className="flex justify-between text-xs text-primary-foreground/85">
            <span>Sprint progress</span>
            <span>
              {activeSprint.completedPoints} / {activeSprint.totalPoints} pts
            </span>
          </div>
          <Progress
            value={progress}
            className="mt-1.5 h-2 bg-primary-foreground/20 [&_[data-slot=progress-indicator]]:bg-[var(--status-done)]"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectPrefix}/sprints`)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary-foreground px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:opacity-90"
        >
          <Plus className="size-4" />
          Start a sprint
        </button>
      )}
    </Card>
  );
}
