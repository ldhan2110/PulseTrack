interface WbsViewToggleProps {
  viewMode: 'gantt' | 'table';
  onChange: (mode: 'gantt' | 'table') => void;
}

export function WbsViewToggle({ viewMode, onChange }: WbsViewToggleProps) {
  return (
    <div className="flex border-b">
      <button
        className={`px-4 py-2 text-xs font-medium transition-colors ${
          viewMode === 'gantt'
            ? 'border-b-2 border-primary text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('gantt')}
      >
        Gantt Chart
      </button>
      <button
        className={`px-4 py-2 text-xs font-medium transition-colors ${
          viewMode === 'table'
            ? 'border-b-2 border-primary text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('table')}
      >
        Table View
      </button>
    </div>
  );
}
