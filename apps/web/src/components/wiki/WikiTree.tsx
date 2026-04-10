import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WikiTreeNode } from '@/lib/types';

const SECTION_ICONS: Record<string, string> = {
  architecture: '🏗️',
  modules: '📦',
  features: '⚡',
  'business-logic': '📐',
  'api-reference': '🔌',
  'data-models': '🗄️',
  glossary: '📚',
  'user-guide': '📖',
  qa: '💬',
};

interface Props {
  tree: WikiTreeNode[];
  selectedPath: string | null;
  onSelectPage: (path: string) => void;
}

function TreeNode({
  node,
  selectedPath,
  onSelectPage,
  depth,
  filter,
}: {
  node: WikiTreeNode;
  selectedPath: string | null;
  onSelectPage: (path: string) => void;
  depth: number;
  filter: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  // Auto-expand directories when filter is active and matches children
  const isFilterActive = !!filter;
  const shouldAutoExpand = isFilterActive && node.type === 'directory' && matchesNode(node, filter);

  if (node.type === 'directory') {
    const matchesFilter =
      !filter ||
      node.name.toLowerCase().includes(filter) ||
      node.children?.some((c) => matchesNode(c, filter));

    if (!matchesFilter) return null;

    const isExpanded = shouldAutoExpand || expanded;

    const icon = SECTION_ICONS[node.name] ?? '';

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full text-left px-2 py-1 text-sm rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isExpanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
          <span>{icon} {node.name}/</span>
        </button>
        {isExpanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelectPage={onSelectPage}
              depth={depth + 1}
              filter={filter}
            />
          ))}
      </div>
    );
  }

  const matchesFilter = !filter || node.name.toLowerCase().includes(filter);
  if (!matchesFilter) return null;

  const isSelected = node.path === selectedPath;

  return (
    <button
      type="button"
      onClick={() => onSelectPage(node.path)}
      className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm rounded ${
        isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <FileText className="size-3.5 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function matchesNode(node: WikiTreeNode, filter: string): boolean {
  if (node.name.toLowerCase().includes(filter)) return true;
  if (node.children) return node.children.some((c) => matchesNode(c, filter));
  return false;
}

export function WikiTree({ tree, selectedPath, onSelectPage }: Props) {
  const [filter, setFilter] = useState('');
  const lowerFilter = filter.toLowerCase();

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter pages..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              onSelectPage={onSelectPage}
              depth={0}
              filter={lowerFilter}
            />
          ))}
          {tree.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              No wiki pages yet. Generate your wiki from Settings.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
