import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useUiStore } from '@/store/uiStore';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { CreateProjectDialog } from '../projects/CreateProjectDialog';
import { useProjectByPrefix } from '@/hooks/useProjects';
import { useMembershipSync } from '@/hooks/useMembershipSync';
import { useTaskSync } from '@/hooks/useTaskSync';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotificationSync } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { ChatDrawer } from '@/components/chat/ChatDrawer';

// 256px expanded, 48px collapsed — per UI-SPEC
const SIDEBAR_WIDTH = '256px';
const SIDEBAR_WIDTH_COLLAPSED = '48px';

export function ProjectLayout() {
  const { projectPrefix } = useParams<{ projectPrefix: string }>();
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const fullWidth = useUiStore((s) => s.fullWidth);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useMembershipSync();
  useNotificationSync();

  // Resolve human-readable prefix to project UUID
  const { data: project } = useProjectByPrefix(projectPrefix ?? '');
  useTaskSync(project?.id);

  useEffect(() => {
    setActiveProjectId(project?.id ?? null);
    return () => {
      // Don't clear on unmount — sidebar should retain project context
    };
  }, [project?.id, setActiveProjectId]);

  return (
    <SidebarProvider
      defaultOpen={!sidebarCollapsed}
      open={!sidebarCollapsed}
      onOpenChange={(open) => setSidebarCollapsed(!open)}
      style={
        {
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_COLLAPSED,
        } as React.CSSProperties
      }
    >
      <AppSidebar onCreateProject={() => setCreateProjectOpen(true)} />
      <SidebarInset className="min-w-0 overflow-hidden">
        <div className="flex justify-between px-4 pt-2">
          <SidebarTrigger className="md:hidden" aria-label="Open sidebar" />
          <div className="ml-auto flex items-center gap-1">
            {project?.id && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open chat"
                onClick={() => setChatOpen(true)}
              >
                <MessageSquare className="size-5" />
              </Button>
            )}
            <NotificationBell />
          </div>
        </div>
        <main className={fullWidth ? 'px-4 pt-2 pb-4 w-full overflow-auto' : 'px-8 pt-4 pb-8 max-w-[1280px] w-full mx-auto overflow-auto'}>
          <Outlet />
        </main>
      </SidebarInset>
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
      {project?.id && (
        <ChatDrawer projectId={project.id} open={chatOpen} onOpenChange={setChatOpen} />
      )}
    </SidebarProvider>
  );
}
