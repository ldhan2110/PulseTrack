import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PlannerScopeProposal } from '@/lib/types';

interface ChatActionSuggestionProps {
  type: string;
  reason: string;
  proposal: PlannerScopeProposal;
  onAccept: (proposal: PlannerScopeProposal) => void;
  onDismiss: () => void;
}

export function ChatActionSuggestion({ type, reason, proposal, onAccept, onDismiss }: ChatActionSuggestionProps) {
  const [draft, setDraft] = useState(proposal);
  useEffect(() => setDraft(proposal), [proposal]);
  const label = type === 'scope_proposal' ? 'Add scope' : type;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
      <FileText className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-1">
        <span className="block text-xs text-muted-foreground">{reason}</span>
        <input aria-label="Proposed scope title" className="h-7 w-full rounded border bg-background px-2 text-xs" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <textarea aria-label="Proposed scope description" className="w-full rounded border bg-background p-2 text-xs" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        {draft.features.map((feature, index) => <input key={index} aria-label={`Feature ${index + 1}`} className="h-7 w-full rounded border bg-background px-2 text-xs" value={feature.title} onChange={(e) => setDraft({ ...draft, features: draft.features.map((item, i) => i === index ? { ...item, title: e.target.value } : item) })} />)}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onAccept(draft)}>{label}</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}
