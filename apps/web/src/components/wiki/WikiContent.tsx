import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { WikiAnnotations } from './WikiAnnotations';
import { useWikiPage } from '@/hooks/useWiki';

interface Props {
  projectId: string;
  pagePath: string | null;
  currentUserId: string;
  scrollToSection: string | null;
  onSectionScrolled: () => void;
}

function parseMarkdownToHtml(markdown: string): string {
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n*/, '');

  return withoutFrontmatter
    .replace(/^#### (.+)$/gm, '<h4 id="$1" class="text-sm font-semibold text-primary mt-6 mb-2">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 id="$1" class="text-base font-semibold text-primary mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 id="$1" class="text-lg font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 id="$1" class="text-xl font-bold mb-4">$1</h1>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted p-3 rounded-md text-sm overflow-x-auto my-3"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(Boolean).map((c) => c.trim());
      const row = cells.map((c) => `<td class="border px-3 py-1.5 text-sm">${c}</td>`).join('');
      return `<tr>${row}</tr>`;
    })
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-sm">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-foreground/80 mb-3">')
    .replace(/\n/g, '<br/>');
}

export function WikiContent({ projectId, pagePath, currentUserId, scrollToSection, onSectionScrolled }: Props) {
  const { data: page, isLoading } = useWikiPage(projectId, pagePath);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToSection && contentRef.current) {
      const target = contentRef.current.querySelector(`[id="${scrollToSection}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          target.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 3000);
        onSectionScrolled();
      }
    }
  }, [scrollToSection, onSectionScrolled]);

  if (!pagePath) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a wiki page from the tree to view its content.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (!page) return null;

  const titleMatch = page.content.match(/^title:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : pagePath.split('/').pop()?.replace('.md', '') ?? '';
  const generatedAtMatch = page.content.match(/^generatedAt:\s*(.+)$/m);
  const generatedAt = generatedAtMatch ? generatedAtMatch[1].trim() : null;

  const html = parseMarkdownToHtml(page.content);

  return (
    <ScrollArea className="h-full">
      <div ref={contentRef} className="p-6 max-w-3xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{pagePath}</p>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          {generatedAt && (
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              Auto-generated · {new Date(generatedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>

        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <WikiAnnotations
          projectId={projectId}
          pagePath={pagePath}
          currentUserId={currentUserId}
        />
      </div>
    </ScrollArea>
  );
}
