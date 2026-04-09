import { Bug, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import type { BugCounts } from '@/lib/types';

interface BugSummaryBannerProps {
  bugCounts: BugCounts;
}

export function BugSummaryBanner({ bugCounts }: BugSummaryBannerProps) {
  const navigate = useNavigate();
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();

  return (
    <Card
      className="cursor-pointer border-red-200 bg-red-50 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:hover:bg-red-950/50"
      onClick={() => navigate(`/projects/${projectPrefix}/bugs`)}
    >
      <div className="flex items-center gap-6 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bug className="size-4 text-red-600 dark:text-red-400" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-300">
            Bug Summary
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">
              {bugCounts.total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Open</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {bugCounts.open}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-red-700 dark:text-red-300" />
            <span className="text-xs text-muted-foreground">Critical</span>
            <span className="text-lg font-bold text-red-700 dark:text-red-300">
              {bugCounts.critical}
            </span>
          </div>
        </div>

        <ExternalLink className="ml-auto size-4 text-muted-foreground" />
      </div>
    </Card>
  );
}
