import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Member } from '@/lib/types';

interface AssigneeRulePanelProps {
  statusName: string;
  statusKey: string;
  members: Member[];
  selectedMemberIds: string[];
  onToggle: (memberId: string) => void;
  onClose: () => void;
}

export function AssigneeRulePanel({
  statusName,
  members,
  selectedMemberIds,
  onToggle,
  onClose,
}: AssigneeRulePanelProps) {
  const selectedSet = new Set(selectedMemberIds);

  return (
    <div className="w-64 border-l bg-card flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <h3 className="text-sm font-semibold">Assignee Rules</h3>
          <p className="text-xs text-muted-foreground">{statusName}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <p className="px-3 pt-2 text-xs text-muted-foreground">
        {selectedMemberIds.length === 0
          ? 'No restrictions — any member can be assigned.'
          : `${selectedMemberIds.length} member(s) allowed.`}
      </p>
      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <Checkbox
                checked={selectedSet.has(m.id)}
                onCheckedChange={() => onToggle(m.id)}
              />
              <div className="flex flex-col">
                <span className="text-sm">{m.user.name ?? m.user.username}</span>
                <span className="text-xs text-muted-foreground capitalize">{m.customRole?.name}</span>
              </div>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
