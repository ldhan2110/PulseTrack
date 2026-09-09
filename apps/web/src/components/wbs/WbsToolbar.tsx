import { Plus, Download, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportWbsToExcel } from '@/lib/exportWbs';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERM } from '@/lib/permissions';
import type { WbsPhase } from '@/lib/types';

interface WbsToolbarProps {
  projectId: string;
  onAddPhase: () => void;
  onImportExcel: () => void;
  onAiSuggest: () => void;
  phases: WbsPhase[];
}

export function WbsToolbar({ projectId, onAddPhase, onImportExcel, onAiSuggest, phases }: WbsToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Work Breakdown Structure</span>
      </div>
      <div className="flex items-center gap-2">
        <PermissionGate projectId={projectId} {...PERM.wbs.create}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAiSuggest}>
            <Sparkles className="size-3" /> AI Suggest
          </Button>
        </PermissionGate>
        <PermissionGate projectId={projectId} {...PERM.wbs.create}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onImportExcel}>
            <Upload className="size-3" /> Import Excel
          </Button>
        </PermissionGate>
        <Button
          size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => exportWbsToExcel(phases)} disabled={phases.length === 0}
        >
          <Download className="size-3" /> Export Excel
        </Button>
        <PermissionGate projectId={projectId} {...PERM.wbs.create}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddPhase}>
            <Plus className="size-3" /> Add Phase
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
}
