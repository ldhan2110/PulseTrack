import { useState } from 'react';
import { Plus, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { PlannerSessionListItem } from '@/lib/types';
import {
  useCreatePlannerSession, useUpdatePlannerSession, useDeletePlannerSession,
} from '@/hooks/usePlanner';

interface PlannerSessionBarProps {
  projectId: string;
  sessions: PlannerSessionListItem[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

export function PlannerSessionBar({
  projectId, sessions, activeSessionId, onSelectSession,
  createOpen: createOpenProp, onCreateOpenChange,
}: PlannerSessionBarProps) {
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
  const createOpen = createOpenProp ?? createOpenLocal;
  const setCreateOpen = onCreateOpenChange ?? setCreateOpenLocal;
  const [newName, setNewName] = useState('');
  const createSession = useCreatePlannerSession(projectId);
  const updateSession = useUpdatePlannerSession(projectId);
  const deleteSession = useDeletePlannerSession(projectId);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const session = await createSession.mutateAsync({ name: newName.trim() });
    onSelectSession(session.id);
    setNewName('');
    setCreateOpen(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/15 text-green-400';
      case 'ARCHIVED': return 'bg-gray-500/15 text-gray-400';
      default: return 'bg-yellow-500/15 text-yellow-400';
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-sm font-semibold">Project Planner</span>
        <Select value={activeSessionId ?? ''} onValueChange={onSelectSession}>
          <SelectTrigger className="h-8 w-[240px] text-sm">
            <SelectValue placeholder="Select a session..." />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3" /> New Session
        </Button>
        {activeSession && (
          <>
            <Badge variant="secondary" className={`text-[10px] ${statusColor(activeSession.status)}`}>
              {activeSession.status}
            </Badge>
            <div className="ml-auto flex gap-1">
              {activeSession.status !== 'ARCHIVED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => updateSession.mutate({ sessionId: activeSession.id, data: { status: 'ARCHIVED' } })}
                >
                  <Archive className="size-3" /> Archive
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-destructive"
                onClick={() => {
                  deleteSession.mutate(activeSession.id);
                  const remaining = sessions.filter((s) => s.id !== activeSession.id);
                  if (remaining.length > 0) onSelectSession(remaining[0].id);
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Planning Session</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Initial Requirements - Apr 2026"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
