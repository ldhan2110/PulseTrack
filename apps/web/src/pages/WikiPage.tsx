import { useState, useCallback } from 'react';
import { BookOpen, Loader2, RefreshCw, Settings } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUiStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useWikiPages, useWikiConfig } from '@/hooks/useWiki';
import { useWikiGeneration } from '@/hooks/useWikiGeneration';
import { useAuth } from '@/auth/useAuth';
import { WikiTree } from '@/components/wiki/WikiTree';
import { WikiContent } from '@/components/wiki/WikiContent';
import { WikiChat } from '@/components/wiki/WikiChat';

export function WikiPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const navigate = useNavigate();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { user } = useAuth();
  const { can } = usePermissions(projectId);

  const { data: tree = [], isLoading: treeLoading } = useWikiPages(projectId);
  const { data: config } = useWikiConfig(projectId);
  const { generate, step, isActive, sectionProgress, completedSections, totalSections } =
    useWikiGeneration(projectId);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);

  const handleScrollToSection = useCallback((section: string) => {
    setScrollToSection(section);
  }, []);

  const handleSectionScrolled = useCallback(() => {
    setScrollToSection(null);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-blue-500" />
          <h1 className="text-lg font-bold">Project Wiki</h1>
          {config?.lastGeneratedAt && (
            <Badge variant="outline" className="text-xs">
              {tree.reduce((acc, n) => acc + countFiles(n), 0)} pages
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {can('projectSettings', 'update') && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generate.mutate()}
                disabled={isActive || generate.isPending}
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isActive ? 'animate-spin' : ''}`} />
                {isActive ? `${step}...` : 'Refresh'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/projects/${projectPrefix}/settings?tab=wiki`)}
              >
                <Settings className="size-3.5 mr-1.5" />
                Settings
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generation progress banner */}
      {isActive && totalSections > 0 && (
        <div className="px-4 py-2 border-b bg-blue-50 dark:bg-blue-950/30 shrink-0">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="font-medium">
              Wiki is being generated — {completedSections}/{totalSections} sections complete
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {sectionProgress.map((sp) => (
              <Badge
                key={sp.section}
                variant={sp.status === 'done' ? 'default' : sp.status === 'error' ? 'destructive' : 'outline'}
                className="text-xs"
              >
                {sp.status === 'generating' && <Loader2 className="size-2.5 animate-spin mr-1" />}
                {sp.section}
                {sp.pagesGenerated ? ` (${sp.pagesGenerated})` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel 1: Tree */}
        <div className="w-56 shrink-0">
          <WikiTree
            tree={tree}
            selectedPath={selectedPath}
            onSelectPage={setSelectedPath}
          />
        </div>

        {/* Panel 2: Content */}
        <div className="flex-1 min-w-0">
          <WikiContent
            projectId={projectId}
            pagePath={selectedPath}
            currentUserId={user?.id ?? ''}
            scrollToSection={scrollToSection}
            onSectionScrolled={handleSectionScrolled}
          />
        </div>

        {/* Panel 3: Chat */}
        <div className="w-80 shrink-0">
          <WikiChat
            projectId={projectId}
            currentPagePath={selectedPath}
            onScrollToSection={handleScrollToSection}
          />
        </div>
      </div>
    </div>
  );
}

function countFiles(node: { type: string; children?: any[] }): number {
  if (node.type === 'file') return 1;
  return node.children?.reduce((acc: number, c: any) => acc + countFiles(c), 0) ?? 0;
}
