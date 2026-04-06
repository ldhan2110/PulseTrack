import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useUiStore } from '@/store/uiStore';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CreateProjectDialog } from '../projects/CreateProjectDialog';
import { useProjectByPrefix } from '@/hooks/useProjects';

// 256px expanded, 48px collapsed — per UI-SPEC
const SIDEBAR_WIDTH = '256px';
const SIDEBAR_WIDTH_COLLAPSED = '48px';

export function ProjectLayout() {
  const { projectPrefix } = useParams<{ projectPrefix: string }>();
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Resolve human-readable prefix to project UUID
  const { data: project } = useProjectByPrefix(projectPrefix ?? '');

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
      <SidebarInset>
        <main className="px-8 pt-6 pb-8 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
      </SidebarInset>
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </SidebarProvider>
  );
}
