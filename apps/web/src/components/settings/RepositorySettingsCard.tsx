import { useState, useEffect } from 'react';
import { GitBranch, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRepositoryConfig, useUpsertRepositoryConfig } from '@/hooks/useRepositoryConfig';
import { useSocket } from '@/socket/useSocket';
import type { CloneStatus } from '@/lib/types';

const STATUS_BADGE: Record<CloneStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  cloning: { label: 'Cloning...', variant: 'outline' },
  cloned: { label: 'Cloned', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
};

interface Props {
  projectId: string;
  canManage: boolean;
}

export function RepositorySettingsCard({ projectId, canManage }: Props) {
  const { data: config, refetch } = useRepositoryConfig(projectId);
  const upsert = useUpsertRepositoryConfig(projectId);
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    if (config && !initialized) {
      setRepoUrl(config.repoUrl ?? '');
      setAccessToken('');
      setInitialized(true);
    }
  }, [config, initialized]);

  // Listen for clone status updates via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = () => { void refetch(); };
    socket.on('repository:status', handler);
    return () => { socket.off('repository:status', handler); };
  }, [socket, refetch]);

  const handleSave = () => {
    if (!repoUrl.trim()) return;
    upsert.mutate({
      repoUrl: repoUrl.trim(),
      accessToken: accessToken || (config?.accessToken ?? ''),
    });
    setInitialized(false);
  };

  const cloneStatus = config?.cloneStatus ?? 'pending';
  const badge = STATUS_BADGE[cloneStatus];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="size-5 text-indigo-500" />
          <CardTitle>Repository</CardTitle>
        </div>
        {config && (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="repoUrl">Repository URL</Label>
          <Input
            id="repoUrl"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://gitlab.company.com/team/repo.git"
            disabled={!canManage}
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
              placeholder={config?.accessToken || 'Enter access token'}
              disabled={!canManage}
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
        {config?.cloneStatus === 'failed' && config.cloneError && (
          <p className="text-xs text-destructive">{config.cloneError}</p>
        )}
        {canManage && (
          <Button
            onClick={handleSave}
            disabled={!repoUrl.trim() || upsert.isPending}
            size="sm"
          >
            {upsert.isPending ? 'Saving...' : 'Save & Clone'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
