import { useState } from 'react';
import { Plug, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useMcpTokens, useCreateMcpToken, useRevokeMcpToken } from '@/hooks/useMcpTokens';
import type { McpToken } from '@/lib/types';

const SCOPES = ['tasks:read', 'bugs:read'] as const;

interface McpAccessCardProps {
  projectId: string;
  canManage: boolean;
}

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
}

function tokenSubtitle(t: McpToken): string {
  if (t.revokedAt) return `Revoked ${new Date(t.revokedAt).toLocaleDateString()}`;
  const used = t.lastUsedAt ? `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : 'Never used';
  const exp = t.expiresAt ? `expires ${new Date(t.expiresAt).toLocaleDateString()}` : 'no expiry';
  return `${used} · ${exp}`;
}

export function McpAccessCard({ projectId, canManage }: McpAccessCardProps) {
  const { data: tokens, isLoading, isError, refetch } = useMcpTokens(projectId);
  const createToken = useCreateMcpToken(projectId);
  const revokeToken = useRevokeMcpToken(projectId);

  // External agents hit the API directly. VITE_API_URL is the absolute API base
  // (ends in /api); fall back to same-origin /api. The route is /api/mcp (global prefix).
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? `${window.location.origin}/api`;
  const connectUrl = `${apiBase.replace(/\/$/, '')}/mcp`;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>(['tasks:read', 'bugs:read']);
  const [expiresAt, setExpiresAt] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const canSubmit = label.trim().length > 0 && scopes.length > 0 && !createToken.isPending;

  function resetForm() {
    setLabel('');
    setScopes(['tasks:read', 'bugs:read']);
    setExpiresAt('');
    setCreatedSecret(null);
  }

  function openDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function toggleScope(scope: string, checked: boolean) {
    setScopes((prev) => (checked ? [...prev, scope] : prev.filter((s) => s !== scope)));
  }

  async function handleCreate() {
    const result = await createToken.mutateAsync({
      label: label.trim(),
      scopes,
      expiresAt: expiresAt || undefined,
    });
    setCreatedSecret(result.token);
  }

  function closeDialog() {
    setDialogOpen(false);
    resetForm();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="size-5 text-emerald-500" />
          <CardTitle>MCP Access</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Let external AI agents (Claude Desktop, Cursor) read this project over the Model Context
          Protocol.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Connect URL</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={connectUrl} className="font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => copy(connectUrl)}>
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Label>Personal Access Tokens</Label>
          {canManage && (
            <Button size="sm" onClick={openDialog}>
              + Create token
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-md bg-muted" />
            <div className="h-14 animate-pulse rounded-md bg-muted" />
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>Couldn't load MCP tokens.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && tokens && tokens.length === 0 && (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No tokens yet.
          </div>
        )}

        {!isLoading && !isError && tokens && tokens.length > 0 && (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
                style={t.revokedAt ? { opacity: 0.6 } : undefined}
              >
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {t.label}
                    {t.revokedAt && (
                      <Badge variant="secondary" className="text-xs">
                        revoked
                      </Badge>
                    )}
                  </span>
                  <div className="flex gap-1">
                    {t.scopes.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{tokenSubtitle(t)}</span>
                </div>
                {canManage && !t.revokedAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={revokeToken.isPending}
                    onClick={() => {
                      if (confirm(`Revoke token "${t.label}"? This cannot be undone.`)) {
                        revokeToken.mutate(t.id);
                      }
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          {createdSecret ? (
            <>
              <DialogHeader>
                <DialogTitle>Token created</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 px-4 pb-2">
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>Copy this now — it will never be shown again. Store it in your agent's MCP config.</span>
                </div>
                <div className="flex items-center justify-between gap-3 break-all rounded-md bg-emerald-950 px-3 py-3 font-mono text-xs text-emerald-100">
                  <span>{createdSecret}</span>
                  <Button variant="outline" size="sm" onClick={() => copy(createdSecret)}>
                    <Copy className="size-4" />
                    Copy
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeDialog}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create MCP token</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 px-4 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="mcp-label">Label</Label>
                  <Input
                    id="mcp-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Cursor — laptop"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <div className="flex gap-4">
                    {SCOPES.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={scopes.includes(scope)}
                          onCheckedChange={(checked) => toggleScope(scope, checked === true)}
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-expires">Expires (optional)</Label>
                  <Input
                    id="mcp-expires"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-52"
                  />
                </div>
                {createToken.isError && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Failed to create token.
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!canSubmit} onClick={() => void handleCreate()}>
                  Create
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
