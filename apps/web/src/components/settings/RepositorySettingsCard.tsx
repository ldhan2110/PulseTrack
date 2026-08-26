import { useState, useEffect } from 'react';
import { GitBranch, Eye, EyeOff, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogBody,
} from '@/components/ui/dialog';
import { useRepositories, useAddRepository, useRemoveRepository, usePullRepository } from '@/hooks/useRepositoryConfig';
import { useSocket } from '@/socket/useSocket';
import type { CloneStatus, IndexStatus } from '@/lib/types';

const STATUS_BADGE: Record<CloneStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  cloning: { label: 'Cloning...', variant: 'outline' },
  cloned: { label: 'Cloned', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
};

const INDEX_BADGE: Record<IndexStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Not indexed', variant: 'secondary' },
  indexing: { label: 'Indexing...', variant: 'outline' },
  indexed: { label: 'Indexed', variant: 'default' },
  failed: { label: 'Index failed', variant: 'destructive' },
};

interface Props {
  projectId: string;
  canManage: boolean;
}

export function RepositorySettingsCard({ projectId, canManage }: Props) {
  const { data: repos = [], refetch } = useRepositories(projectId);
  const addRepo = useAddRepository(projectId);
  const removeRepo = useRemoveRepository(projectId);
  const pullRepo = usePullRepository(projectId);
  const socket = useSocket();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [provider, setProvider] = useState<'github' | 'gitlab'>('gitlab');
  const [branch, setBranch] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);

  // Listen for clone status updates via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = () => { void refetch(); };
    socket.on('repository:status', handler);
    return () => { socket.off('repository:status', handler); };
  }, [socket, refetch]);

  const resetForm = () => {
    setName('');
    setRepoUrl('');
    setAccessToken('');
    setProvider('gitlab');
    setBranch('');
  };

  const handleAdd = () => {
    if (!name.trim() || !repoUrl.trim() || !accessToken.trim()) return;
    addRepo.mutate(
      {
        name: name.trim(),
        repoUrl: repoUrl.trim(),
        accessToken: accessToken.trim(),
        provider,
        ...(branch.trim() ? { branch: branch.trim() } : {}),
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          resetForm();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="size-5 text-indigo-500" />
          <CardTitle>Repositories</CardTitle>
        </div>
        {canManage && (
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="size-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Repository</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="web (letters, digits, -, _)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repoUrl">Repository URL</Label>
                    <Input
                      id="repoUrl"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://gitlab.company.com/team/repo.git"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <div className="relative">
                      <Input
                        id="accessToken"
                        type={showToken ? 'text' : 'password'}
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="Enter access token"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as 'github' | 'gitlab')}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="github">GitHub</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Input
                      id="branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="Default branch"
                    />
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancel</Button>
                </DialogClose>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!name.trim() || !repoUrl.trim() || !accessToken.trim() || addRepo.isPending}
                >
                  {addRepo.isPending ? 'Adding...' : 'Add & Clone'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {repos.length === 0 && (
          <p className="text-sm text-muted-foreground">No repositories yet.</p>
        )}
        {repos.map((repo) => {
          const badge = STATUS_BADGE[repo.cloneStatus];
          const indexBadge = INDEX_BADGE[repo.indexStatus];
          return (
            <div key={repo.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{repo.name}</span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <Badge variant={indexBadge.variant}>{indexBadge.label}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{repo.repoUrl}</p>
                {repo.cloneStatus === 'failed' && repo.cloneError && (
                  <p className="text-xs text-destructive">{repo.cloneError}</p>
                )}
                {repo.indexStatus === 'failed' && repo.indexError && (
                  <p className="text-xs text-destructive">{repo.indexError}</p>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => pullRepo.mutate(repo.id)}
                    disabled={repo.cloneStatus !== 'cloned' || pullRepo.isPending || repo.indexStatus === 'indexing'}
                    title="Pull latest & re-index"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <RefreshCw className={`size-4 ${repo.indexStatus === 'indexing' ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setRemoveId(repo.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!removeId} onOpenChange={(o) => { if (!o) setRemoveId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Repository</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              This removes the repository and its cloned folder. Other repositories are unaffected.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (removeId) removeRepo.mutate(removeId, { onSuccess: () => setRemoveId(null) });
              }}
              disabled={removeRepo.isPending}
            >
              {removeRepo.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
