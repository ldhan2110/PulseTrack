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

export function DashboardHero({ name, activeSprint, projectPrefix }: DashboardHeroProps) {
  const navigate = useNavigate();

  const progress =
    activeSprint && activeSprint.totalPoints > 0
      ? Math.round((activeSprint.completedPoints / activeSprint.totalPoints) * 100)
      : 0;

  return (
    <Card className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">👋</span>
        <span className="text-base font-semibold">Welcome back, {name}</span>
      </div>

      {activeSprint ? (
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{activeSprint.name}</span>
            {' · '}
            {daysLeft(activeSprint.endDate)} days left
          </div>
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-2 w-28" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {activeSprint.completedPoints}/{activeSprint.totalPoints}
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectPrefix}/sprints`)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          <Plus className="size-4" />
          Start a sprint
        </button>
      )}
    </Card>
  );
}
