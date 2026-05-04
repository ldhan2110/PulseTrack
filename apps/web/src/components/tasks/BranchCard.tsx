import { useState } from 'react';
import { GitBranch, GitPullRequest, ExternalLink, Plus, Copy, Check, ChevronsUpDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import { useRemoteBranches, useTaskBranches, useCreateBranch, useCreatePr, useDeleteBranch } from '@/hooks/useBranches';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import type { BranchType, TaskBranch } from '@/lib/types';

const BRANCH_TYPES: { value: BranchType; label: string }[] = [
  { value: 'feat', label: 'Feature' },
  { value: 'fix', label: 'Fix' },
  { value: 'chore', label: 'Chore' },
  { value: 'hotfix', label: 'Hotfix' },
  { value: 'refactor', label: 'Refactor' },
];

const PR_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  open: 'default',
  merged: 'secondary',
  closed: 'destructive',
};

function BranchCombobox({
  value,
  onChange,
  branches,
  loading,
  placeholder = 'Default branch',
}: {
  value: string;
  onChange: (v: string) => void;
  branches: string[];
  loading?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="truncate">
            {loading ? 'Loading branches...' : value || placeholder}
          </span>
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search branches..." className="h-8 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="py-3 text-xs">No branch found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__default__"
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
                data-checked={!value}
              >
                <span className="text-xs text-muted-foreground">{placeholder}</span>
              </CommandItem>
              {branches.map((b) => (
                <CommandItem
                  key={b}
                  value={b}
                  onSelect={() => {
                    onChange(b);
                    setOpen(false);
                  }}
                  data-checked={value === b}
                >
                  <span className="text-xs truncate">{b}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  projectId: string;
  taskId: string;
}

export function BranchCard({ projectId, taskId }: Props) {
  const { data: repoConfig } = useRepositoryConfig(projectId);
  const { data: branches = [] } = useTaskBranches(projectId, taskId);
  const createBranch = useCreateBranch(projectId, taskId);
  const createPr = useCreatePr(projectId, taskId);
  const deleteBranch = useDeleteBranch(projectId, taskId);
  const { data: remoteBranches = [], isLoading: branchesLoading } = useRemoteBranches(projectId);

  const [branchType, setBranchType] = useState<BranchType>('feat');
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [prDialogBranchId, setPrDialogBranchId] = useState<string | null>(null);
  const [deleteDialogBranchId, setDeleteDialogBranchId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!repoConfig || repoConfig.cloneStatus !== 'cloned') return null;

  const handleCreateBranch = () => {
    createBranch.mutate(
      { branchType, sourceBranch: sourceBranch || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setSourceBranch('');
        },
      },
    );
  };

  const handleCreatePr = (branchId: string) => {
    createPr.mutate(
      { branchId, targetBranch: targetBranch || undefined },
      {
        onSuccess: () => {
          setPrDialogBranchId(null);
          setTargetBranch('');
        },
      },
    );
  };

  const copyBranchName = (branch: TaskBranch) => {
    void navigator.clipboard.writeText(branch.branchName);
    setCopiedId(branch.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const providerLabel = repoConfig.provider === 'github' ? 'PR' : 'MR';

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GitBranch className="size-4 text-indigo-500" />
          <h4 className="text-sm font-semibold">Branches</h4>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6">
              <Plus className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Branch</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Branch Type</Label>
                  <Select value={branchType} onValueChange={(v) => setBranchType(v as BranchType)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCH_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Source Branch</Label>
                  <BranchCombobox
                    value={sourceBranch}
                    onChange={setSourceBranch}
                    branches={remoteBranches}
                    loading={branchesLoading}
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
                onClick={handleCreateBranch}
                disabled={createBranch.isPending}
              >
                {createBranch.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {branches.length === 0 && (
        <p className="text-xs text-muted-foreground">No branches yet</p>
      )}

      <Dialog
        open={!!deleteDialogBranchId}
        onOpenChange={(open) => { if (!open) setDeleteDialogBranchId(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Branch Record</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              This will only remove the branch record from PulseTrack. The actual git branch and any PR/MR will remain untouched.
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
                if (deleteDialogBranchId) {
                  deleteBranch.mutate(deleteDialogBranchId, {
                    onSuccess: () => setDeleteDialogBranchId(null),
                  });
                }
              }}
              disabled={deleteBranch.isPending}
            >
              {deleteBranch.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {branches.map((branch) => (
        <div key={branch.id} className="space-y-1.5">
          {branches.length > 1 && branches.indexOf(branch) > 0 && <Separator />}
          <div className="flex items-center gap-1.5">
            <code className="text-xs font-mono truncate flex-1">{branch.branchName}</code>
            <button
              onClick={() => copyBranchName(branch)}
              className="text-muted-foreground hover:text-foreground"
            >
              {copiedId === branch.id ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
            <button
              onClick={() => setDeleteDialogBranchId(branch.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          </div>

          {branch.prUrl ? (
            <a
              href={branch.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline"
            >
              <GitPullRequest className="size-3" />
              <span>{providerLabel} #{branch.prNumber}</span>
              {branch.prStatus && (
                <Badge variant={PR_STATUS_VARIANT[branch.prStatus] ?? 'outline'} className="text-[10px] px-1 py-0">
                  {branch.prStatus}
                </Badge>
              )}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <Dialog
              open={prDialogBranchId === branch.id}
              onOpenChange={(open) => setPrDialogBranchId(open ? branch.id : null)}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                  <GitPullRequest className="size-3" />
                  Create {providerLabel}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Create {providerLabel}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Target Branch</Label>
                      <BranchCombobox
                        value={targetBranch}
                        onChange={setTargetBranch}
                        branches={remoteBranches}
                        loading={branchesLoading}
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
                    onClick={() => handleCreatePr(branch.id)}
                    disabled={createPr.isPending}
                  >
                    {createPr.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      ))}
    </div>
  );
}
