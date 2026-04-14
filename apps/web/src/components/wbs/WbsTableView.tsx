import { WbsTaskTree } from './WbsTaskTree';
import type { WbsPhase, WbsTask, WbsSubtask } from '@/lib/types';

interface WbsTableViewProps {
  phases: WbsPhase[];
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onEditPhase: (phase: WbsPhase) => void;
  onEditTask: (task: WbsTask) => void;
  onEditSubtask: (subtask: WbsSubtask) => void;
  projectId: string;
}

export function WbsTableView({
  phases, collapsedIds, onToggleCollapse,
  onEditPhase, onEditTask, onEditSubtask, projectId,
}: WbsTableViewProps) {
  return (
    <div className="h-full overflow-auto">
      <WbsTaskTree
        phases={phases}
        collapsedIds={collapsedIds}
        onToggleCollapse={onToggleCollapse}
        onAddTask={() => {}}
        onAddSubtask={() => {}}
        onEditPhase={onEditPhase}
        onEditTask={onEditTask}
        onEditSubtask={onEditSubtask}
        projectId={projectId}
      />
    </div>
  );
}
