import { useState, useRef, useEffect } from 'react';
import { Send, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sectionRefs?: string[];
  timestamp: Date;
}

interface Props {
  projectId: string;
  onScrollToSection: (section: string) => void;
}

const QUICK_PROMPTS = [
  { label: 'Explain this module', prompt: 'Explain what this module does and its key responsibilities' },
  { label: 'Impact of changes', prompt: 'What modules would be affected if this code changes?' },
  { label: 'Business rules', prompt: 'What are the business rules and constraints?' },
];

export function WikiChat({ projectId, onScrollToSection }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const question = text || input.trim();
    if (!question || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { jobId } = await api.askWiki(projectId, question);

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const status = await api.getWikiGenerationStatus(projectId, jobId);
          if (status.status === 'completed') {
            clearInterval(poll);
            const answer = status.streamText || 'No answer generated.';
            const sectionRefs = extractSectionRefs(answer);
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: answer,
              sectionRefs,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsLoading(false);
          } else if (status.status === 'failed') {
            clearInterval(poll);
            toast.error(status.error || 'Q&A failed');
            setIsLoading(false);
          } else if (attempts > 120) {
            clearInterval(poll);
            toast.error('Q&A timed out');
            setIsLoading(false);
          }
        } catch {
          clearInterval(poll);
          setIsLoading(false);
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to ask question');
      setIsLoading(false);
    }
  };

  const handleSectionClick = (section: string) => {
    onScrollToSection(section);
  };

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Ask Wiki</h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          <History className="size-3.5 mr-1" />
          History
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ask questions about your project. AI reads wiki pages and code-graph for answers.
            </p>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'assistant' && (
                <p className="text-[10px] text-green-500 mb-1">Wiki AI</p>
              )}
              <div
                className={`text-sm rounded-xl px-3 py-2 max-w-[90%] ${
                  msg.role === 'user'
                    ? 'bg-muted ml-auto'
                    : 'bg-card border'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sectionRefs && msg.sectionRefs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.sectionRefs.map((ref) => (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => handleSectionClick(ref)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        See: {ref}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div>
              <p className="text-[10px] text-green-500 mb-1">Wiki AI</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Analyzing wiki and code graph...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              type="button"
              onClick={() => handleSend(qp.prompt)}
              className="text-[10px] bg-muted px-2 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              {qp.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this project..."
            className="text-sm"
            disabled={isLoading}
          />
          <Button size="icon" onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          AI reads wiki + code-graph. Answers auto-save to qa/
        </p>
      </div>
    </div>
  );
}

function extractSectionRefs(text: string): string[] {
  const refs: string[] = [];
  const matches = text.matchAll(/See:\s*([^\n]+)/g);
  for (const match of matches) {
    refs.push(match[1].trim());
  }
  return refs;
}
