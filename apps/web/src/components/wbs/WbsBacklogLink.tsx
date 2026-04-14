import { useState } from 'react';
import { Link, Unlink, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLinkWbsBacklog, useUnlinkWbsBacklog } from '@/hooks/useWbs';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface WbsBacklogLinkProps {
  nodeType: 'task' | 'subtask';
  nodeId: string;
  backlogItemId: string | null;
  projectId: string;
}

export function WbsBacklogLink({ nodeType, nodeId, backlogItemId, projectId }: WbsBacklogLinkProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const linkMutation = useLinkWbsBacklog(projectId);
  const unlinkMutation = useUnlinkWbsBacklog(projectId);

  const { data: tasks = [] } = useQuery({
    queryKey: ['backlog-tasks', projectId],
    queryFn: () => api.getTasks(projectId),
    enabled: open && !!projectId,
  });

  const filtered = tasks.filter((t: any) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.taskKey && t.taskKey.toLowerCase().includes(search.toLowerCase())),
  );

  if (backlogItemId) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1 text-blue-400"
        onClick={() => unlinkMutation.mutate({ nodeType, nodeId })}
      >
        <Unlink className="size-3" /> Unlink
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <Link className="size-3" /> Link Backlog
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link Backlog Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filtered.map((task: any) => (
                <button
                  key={task.id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted/50 flex items-center gap-2"
                  onClick={() => {
                    linkMutation.mutate(
                      { nodeType, nodeId, data: { backlogItemId: task.id } },
                      { onSuccess: () => setOpen(false) },
                    );
                  }}
                >
                  <span className="text-xs text-muted-foreground">{task.taskKey}</span>
                  <span className="truncate">{task.title}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
