import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import mermaid from 'mermaid';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { WikiAnnotations } from './WikiAnnotations';
import { useWikiPage } from '@/hooks/useWiki';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

function MermaidBlock({ children }: { children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
    mermaid.render(id, children).then(({ svg }) => setSvg(svg)).catch(() => {
      setSvg(`<pre class="text-red-500 text-sm">Failed to render mermaid diagram</pre>`);
    });
  }, [children]);

  return <div ref={ref} className="my-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}

interface Props {
  projectId: string;
  pagePath: string | null;
  currentUserId: string;
  scrollToSection: string | null;
  onSectionScrolled: () => void;
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

  const contentWithoutFrontmatter = page.content.replace(/^---[\s\S]*?---\n*/, '');

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

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeSlug]}
            components={{
              h1: ({ children, ...props }) => (
                <h1 className="text-xl font-bold mb-4" {...props}>{children}</h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 className="text-lg font-bold mt-8 mb-3" {...props}>{children}</h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 className="text-base font-semibold text-primary mt-6 mb-2" {...props}>{children}</h3>
              ),
              h4: ({ children, ...props }) => (
                <h4 className="text-sm font-semibold text-primary mt-6 mb-2" {...props}>{children}</h4>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="w-full border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border px-3 py-1.5 text-sm font-semibold bg-muted text-left">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border px-3 py-1.5 text-sm">{children}</td>
              ),
              li: ({ children }) => (
                <li className="ml-4 text-sm">{children}</li>
              ),
              p: ({ children }) => (
                <p className="text-sm text-foreground/80 mb-3">{children}</p>
              ),
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const lang = match?.[1];
                const codeStr = String(children).replace(/\n$/, '');

                if (lang === 'mermaid') {
                  return <MermaidBlock>{codeStr}</MermaidBlock>;
                }

                if (!className) {
                  return (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto my-3">
                  {children}
                </pre>
              ),
            }}
          >
            {contentWithoutFrontmatter}
          </ReactMarkdown>
        </div>

        <WikiAnnotations
          projectId={projectId}
          pagePath={pagePath}
          currentUserId={currentUserId}
        />
      </div>
    </ScrollArea>
  );
}
