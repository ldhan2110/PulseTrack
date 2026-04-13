import { useState, useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { usePlannerSessions, usePlannerSession, usePlannerMessages, usePlannerScopes } from '@/hooks/usePlanner';
import { PlannerSessionBar } from '@/components/planner/PlannerSessionBar';
import { PlannerChatPanel } from '@/components/planner/PlannerChatPanel';
import { PlannerScopePanel } from '@/components/planner/PlannerScopePanel';
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';

export function PlannerPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { data: sessions } = usePlannerSessions(projectId);
  const { data: session } = usePlannerSession(projectId, activeSessionId ?? '');
  const { data: messages } = usePlannerMessages(activeSessionId ?? '');
  const { data: scopes } = usePlannerScopes(activeSessionId ?? '');

  useEffect(() => {
    if (!activeSessionId && sessions && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  return (
    <div className="flex h-full flex-col">
      <PlannerSessionBar
        projectId={projectId}
        sessions={sessions ?? []}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
      />
      {activeSessionId ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
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
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Create a planning session to get started.
        </div>
      )}
    </div>
  );
}
