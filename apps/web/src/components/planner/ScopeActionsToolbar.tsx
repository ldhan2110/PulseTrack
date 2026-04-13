import { FileText, Download, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ScopeActionsToolbarProps {
  scopeCount: number;
  featureCount: number;
  onGeneratePrd: () => void;
  onExport: () => void;
  onSummarize: () => void;
}

export function ScopeActionsToolbar({
  scopeCount, featureCount, onGeneratePrd, onExport, onSummarize,
}: ScopeActionsToolbarProps) {
  return (
    <div className="flex items-center justify-between border-t px-3 py-2">
      <span className="text-xs text-muted-foreground">
        {scopeCount} scopes · {featureCount} features
      </span>
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onGeneratePrd}>
              <FileText className="size-3" /> PRD
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate PRD from scopes</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onExport}>
              <Download className="size-3" /> Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export scopes as Markdown</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onSummarize}>
              <MessageSquare className="size-3" /> Summary
            </Button>
          </TooltipTrigger>
          <TooltipContent>Summarize planning session</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
