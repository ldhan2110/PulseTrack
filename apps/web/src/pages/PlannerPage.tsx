import { useState, useEffect } from 'react';
import { Plus, MessageSquare, LayoutList, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/uiStore';
import { usePlannerSessions, usePlannerSession, usePlannerMessages, usePlannerScopes } from '@/hooks/usePlanner';
import { PlannerSessionBar } from '@/components/planner/PlannerSessionBar';
import { PlannerChatPanel } from '@/components/planner/PlannerChatPanel';
import { PlannerScopePanel } from '@/components/planner/PlannerScopePanel';
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';

const STEPS = [
  {
    num: 1,
    title: 'Create a session',
    desc: 'Name your planning session to get started',
    icon: Plus,
  },
  {
    num: 2,
    title: 'Chat with AI',
    desc: 'Describe your project vision and requirements',
    icon: MessageSquare,
  },
  {
    num: 3,
    title: 'Review scopes & features',
    desc: 'Refine AI-generated requirements and priorities',
    icon: LayoutList,
  },
];

export function PlannerPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const setFullWidth = useUiStore((s) => s.setFullWidth);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sessions } = usePlannerSessions(projectId);
  usePlannerSession(projectId, activeSessionId ?? '');
  const { data: messages } = usePlannerMessages(activeSessionId ?? '');
  const { data: scopes } = usePlannerScopes(activeSessionId ?? '');

  useEffect(() => {
    setFullWidth(true);
    return () => setFullWidth(false);
  }, [setFullWidth]);

  useEffect(() => {
    if (!activeSessionId && sessions && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <PlannerSessionBar
        projectId={projectId}
        sessions={sessions ?? []}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
      {activeSessionId ? (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={50} minSize={30}>
            <PlannerChatPanel
              sessionId={activeSessionId}
              messages={messages ?? []}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={30}>
            <PlannerScopePanel
              sessionId={activeSessionId}
              scopes={scopes ?? []}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="flex flex-col items-center gap-12 md:flex-row md:items-center md:gap-20">
            {/* Left — headline + CTA */}
            <div className="max-w-sm text-center md:text-left">
              <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <Sparkles className="size-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Plan your project with AI
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Describe what you're building and let AI help you break it down
                into scopes, features, and actionable requirements.
              </p>
              <Button
                className="mt-6 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                New Planning Session
              </Button>
            </div>

            {/* Right — 3-step workflow */}
            <div className="flex flex-col gap-3">
              {STEPS.map((step) => (
                <div
                  key={step.num}
                  className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 px-5 py-4 backdrop-blur-sm transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5"
                  style={{ minWidth: 280 }}
                >
                  <span className="text-xl font-bold text-indigo-400">
                    {step.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                  <step.icon className="ml-auto size-4 shrink-0 text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
