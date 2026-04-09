import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTestSuite } from '@/hooks/useTestSuites';
import { useTestCases } from '@/hooks/useTestCases';
import type { TestCase } from '@/lib/types';

interface SuiteManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  suiteId: string;
}

export function SuiteManager({ open, onOpenChange, projectId, suiteId }: SuiteManagerProps) {
  const queryClient = useQueryClient();
  const { data: suite } = useTestSuite(projectId, suiteId);
  const { data: allCases = [] } = useTestCases(projectId);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const memberCaseIds = new Set(suite?.members?.map((m) => m.testCase.id) ?? []);

  const availableCases = (allCases as TestCase[]).filter(
    (tc) => !memberCaseIds.has(tc.id) && tc.title.toLowerCase().includes(search.toLowerCase()),
  );

  const addMembers = useMutation({
    mutationFn: (testCaseIds: string[]) => api.addSuiteMembers(projectId, suiteId, testCaseIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suite', projectId, suiteId] });
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      setSelectedIds(new Set());
      toast.success('Cases added to suite');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (testCaseId: string) => api.removeSuiteMember(projectId, suiteId, testCaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suite', projectId, suiteId] });
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Case removed from suite');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (selectedIds.size === 0) return;
    addMembers.mutate(Array.from(selectedIds));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[520px] max-w-full max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Suite{suite ? ` - ${suite.name}` : ''}</DialogTitle>
        </DialogHeader>

        {/* Current members */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Members ({suite?.members?.length ?? 0})</span>
          <div className="max-h-[180px] overflow-y-auto flex flex-col gap-1">
            {suite?.members?.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No test cases in this suite.</p>
            )}
            {suite?.members?.map((member) => (
              <div key={member.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 text-sm">
                {member.testCase.testCaseKey && (
                  <span className="text-xs font-mono text-muted-foreground">{member.testCase.testCaseKey}</span>
                )}
                <span className="flex-1 truncate">{member.testCase.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeMember.mutate(member.testCase.id)}
                  disabled={removeMember.isPending}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Add cases */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <span className="text-[13px] font-semibold">Add Cases</span>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search test cases..."
              className="h-8 pl-7 text-sm"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5">
            {availableCases.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No available test cases.</p>
            )}
            {availableCases.map((tc) => (
              <label
                key={tc.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 text-sm cursor-pointer',
                  selectedIds.has(tc.id) && 'bg-muted/50',
                )}
              >
                <Checkbox
                  checked={selectedIds.has(tc.id)}
                  onCheckedChange={() => toggleSelected(tc.id)}
                />
                {tc.testCaseKey && (
                  <span className="text-xs font-mono text-muted-foreground">{tc.testCaseKey}</span>
                )}
                <span className="truncate">{tc.title}</span>
              </label>
            ))}
          </div>
          {selectedIds.size > 0 && (
            <Button
              type="button"
              size="sm"
              className="self-start gap-1"
              onClick={handleAdd}
              disabled={addMembers.isPending}
            >
              <Plus className="size-3" />
              Add {selectedIds.size} case{selectedIds.size > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
