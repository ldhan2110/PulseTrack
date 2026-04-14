import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Zap, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WbsTaskRowProps {
  level: 0 | 1 | 2;
  title: string;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  progress: string;
  isRollup: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdd?: () => void;
  backlogItemId?: string | null;
}

const INDENT = { 0: 'pl-2', 1: 'pl-6', 2: 'pl-10' };
const BG = { 0: 'bg-muted/20', 1: '', 2: '' };

export function WbsTaskRow({
  level, title, planStart, planEnd, actualStart, actualEnd, progress,
  isRollup, isCollapsed, onToggle, onEdit, onDelete, onAdd, backlogItemId,
}: WbsTaskRowProps) {
  return (
    <div
      className={`group grid grid-cols-[1fr_68px_68px_68px_68px_50px] gap-0 border-b px-2 text-xs hover:bg-muted/10 items-center ${BG[level]}`}
      style={{ height: 33 }}
    >
      {/* Name cell */}
      <div className={`flex items-center gap-1 min-w-0 ${INDENT[level]}`}>
        {onToggle ? (
          <button onClick={onToggle} className="shrink-0 text-muted-foreground/60 hover:text-foreground">
            {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : level < 2 ? (
          <span className="size-3.5 shrink-0" />
        ) : null}

        {level === 0 && <span className="text-primary font-semibold truncate">{title}</span>}
        {level === 1 && <span className="text-foreground truncate">{title}</span>}
        {level === 2 && <span className="text-muted-foreground truncate">{title}</span>}

        {isRollup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Zap className="size-3 text-amber-500 shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Auto-calculated from children</TooltipContent>
          </Tooltip>
        )}

        {backlogItemId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link className="size-3 text-blue-400 shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Linked to backlog</TooltipContent>
          </Tooltip>
        )}

        {/* Hover actions */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onAdd && (
            <Button variant="ghost" size="icon" className="size-5" onClick={onAdd}>
              <Plus className="size-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-5" onClick={onEdit}>
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-5 text-destructive" onClick={onDelete}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Date cells */}
      <span className="text-[10px] text-muted-foreground flex items-center">{planStart}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{planEnd}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{actualStart}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{actualEnd}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{progress}</span>
    </div>
  );
}
