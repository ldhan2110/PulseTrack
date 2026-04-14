import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WbsToolbarProps {
  onAddPhase: () => void;
}

export function WbsToolbar({ onAddPhase }: WbsToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Work Breakdown Structure</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddPhase}>
          <Plus className="size-3" /> Add Phase
        </Button>
      </div>
    </div>
  );
}
