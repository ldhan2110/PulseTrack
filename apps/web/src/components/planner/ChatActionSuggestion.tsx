import { Button } from '@/components/ui/button';
import { FileText, MessageSquare } from 'lucide-react';

interface ChatActionSuggestionProps {
  type: string;
  reason: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ChatActionSuggestion({ type, reason, onAccept, onDismiss }: ChatActionSuggestionProps) {
  const label = type === 'generate_prd' ? 'Generate PRD' :
    type === 'summarize' ? 'Summarize Session' : type;
  const Icon = type === 'generate_prd' ? FileText : MessageSquare;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
      <Icon className="size-4 text-primary" />
      <span className="flex-1 text-xs text-muted-foreground">{reason}</span>
      <Button size="sm" variant="default" className="h-7 text-xs" onClick={onAccept}>
        {label}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismiss}>
        Later
      </Button>
    </div>
  );
}
