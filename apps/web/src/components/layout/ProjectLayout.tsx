import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useUiStore } from '@/store/uiStore';
import { SidebarInset } from '@/components/ui/sidebar';
import { CreateProjectDialog } from '../projects/CreateProjectDialog';

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  useEffect(() => {
    setActiveProjectId(projectId ?? null);
    return () => {
      // Don't clear on unmount — sidebar should retain project context
    };
  }, [projectId, setActiveProjectId]);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar onCreateProject={() => setCreateProjectOpen(true)} />
      <SidebarInset className="flex-1 min-w-0">
        <main className="px-8 pt-6 pb-8 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
      </SidebarInset>
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </div>
  );
}
