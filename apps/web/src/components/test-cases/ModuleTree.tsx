import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ListChecks,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  useTestModules,
  useCreateTestModule,
  useUpdateTestModule,
  useDeleteTestModule,
} from '@/hooks/useTestModules';
import {
  useTestSuites,
  useCreateTestSuite,
  useDeleteTestSuite,
} from '@/hooks/useTestSuites';
import type { TestModule, TestSuite } from '@/lib/types';

interface ModuleTreeProps {
  projectId: string;
  selectedModuleId: string | null;
  onSelectModule: (id: string | null) => void;
  selectedSuiteId: string | null;
  onSelectSuite: (id: string | null) => void;
}

interface ModuleNode extends TestModule {
  children: ModuleNode[];
}

function buildTree(modules: TestModule[]): ModuleNode[] {
  const map = new Map<string, ModuleNode>();
  const roots: ModuleNode[] = [];

  for (const m of modules) {
    map.set(m.id, { ...m, children: [] });
  }
  for (const m of modules) {
    const node = map.get(m.id)!;
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (arr: ModuleNode[]) => {
    arr.sort((a, b) => a.position - b.position);
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function ModuleTree({
  projectId,
  selectedModuleId,
  onSelectModule,
  selectedSuiteId,
  onSelectSuite,
}: ModuleTreeProps) {
  const { data: modules = [] } = useTestModules(projectId);
  const { data: suites = [] } = useTestSuites(projectId);
  const createModule = useCreateTestModule(projectId);
  const updateModule = useUpdateTestModule(projectId);
  const deleteModule = useDeleteTestModule(projectId);
  const createSuite = useCreateTestSuite(projectId);
  const deleteSuite = useDeleteTestSuite(projectId);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  const [createSuiteOpen, setCreateSuiteOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const tree = useMemo(() => buildTree(modules), [modules]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateModule = () => {
    if (!newName.trim()) return;
    createModule.mutate({ name: newName.trim() }, {
      onSuccess: () => {
        setNewName('');
        setCreateModuleOpen(false);
      },
    });
  };

  const handleCreateSuite = () => {
    if (!newName.trim()) return;
    createSuite.mutate({ name: newName.trim() }, {
      onSuccess: () => {
        setNewName('');
        setCreateSuiteOpen(false);
      },
    });
  };

  const handleRename = (moduleId: string) => {
    if (!editName.trim()) return;
    updateModule.mutate({ moduleId, data: { name: editName.trim() } }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const handleSelectModule = (id: string | null) => {
    onSelectModule(id);
    onSelectSuite(null);
  };

  const handleSelectSuite = (id: string) => {
    onSelectSuite(id);
    onSelectModule(null);
  };

  function renderNode(node: ModuleNode, depth: number = 0) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedModuleId === node.id && !selectedSuiteId;
    const isEditing = editingId === node.id;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer hover:bg-muted/50 group',
            isSelected && 'bg-muted',
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => handleSelectModule(node.id)}
          onDoubleClick={() => {
            setEditingId(node.id);
            setEditName(node.name);
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 hover:bg-muted rounded"
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="size-4.5" />
          )}
          {isExpanded ? <FolderOpen className="size-3.5 text-muted-foreground shrink-0" /> : <Folder className="size-3.5 text-muted-foreground shrink-0" />}
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="h-6 text-sm flex-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1">{node.name}</span>
          )}
          <span className="text-xs text-muted-foreground">{node._count?.testCases ?? 0}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => { setEditingId(node.id); setEditName(node.name); }}>
                <Pencil className="size-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteModule.mutate(node.id)}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Modules section */}
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modules</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          onClick={() => { setNewName(''); setCreateModuleOpen(true); }}
        >
          <Plus className="size-3" />
        </Button>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted/50',
          selectedModuleId === null && !selectedSuiteId && 'bg-muted',
        )}
        onClick={() => handleSelectModule(null)}
      >
        <List className="size-3.5 text-muted-foreground" />
        <span>All Test Cases</span>
      </div>

      {tree.map((node) => renderNode(node))}

      <Separator className="my-2" />

      {/* Suites section */}
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suites</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          onClick={() => { setNewName(''); setCreateSuiteOpen(true); }}
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {suites.map((suite: TestSuite) => (
        <div
          key={suite.id}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted/50 group',
            selectedSuiteId === suite.id && 'bg-muted',
          )}
          onClick={() => handleSelectSuite(suite.id)}
        >
          <ListChecks className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{suite.name}</span>
          <span className="text-xs text-muted-foreground">{suite._count?.members ?? 0}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteSuite.mutate(suite.id)}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {/* Create Module Dialog */}
      <Dialog open={createModuleOpen} onOpenChange={setCreateModuleOpen}>
        <DialogContent className="w-[360px] max-w-full">
          <DialogHeader>
            <DialogTitle>Create Module</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold leading-none">Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Module name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateModule(); }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateModuleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateModule} disabled={!newName.trim() || createModule.isPending}>
              {createModule.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Suite Dialog */}
      <Dialog open={createSuiteOpen} onOpenChange={setCreateSuiteOpen}>
        <DialogContent className="w-[360px] max-w-full">
          <DialogHeader>
            <DialogTitle>Create Suite</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold leading-none">Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Suite name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSuite(); }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateSuiteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSuite} disabled={!newName.trim() || createSuite.isPending}>
              {createSuite.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
