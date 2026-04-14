interface WbsStatusBarProps {
  phaseCount: number;
  taskCount: number;
  subtaskCount: number;
  overallProgress: number;
}

export function WbsStatusBar({ phaseCount, taskCount, subtaskCount, overallProgress }: WbsStatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <div className="flex gap-4">
        <span>{phaseCount} Phases</span>
        <span>{taskCount} Tasks</span>
        <span>{subtaskCount} Subtasks</span>
      </div>
      <div>
        Overall: <span className="text-foreground font-medium">{overallProgress}%</span>
      </div>
    </div>
  );
}
