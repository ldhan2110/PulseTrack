import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/auth/useAuth';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { formatDistanceToNow } from 'date-fns';
import type { Project } from '@/lib/types';

// FieldGroup composition per shadcn skill rules
function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const member = project.members?.find((m) => m.userId === user?.id);
  const role = member?.customRole?.name;

  const taskCount = project._count?.tasks ?? 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/projects/${project.prefix}/dashboard`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[20px] font-semibold leading-tight">
            {project.name}
          </CardTitle>
          {role && (
            <Badge variant="secondary" className="shrink-0 text-[13px]">
              {role}
            </Badge>
          )}
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-sm text-muted-foreground">
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </div>
      </CardContent>
      <CardFooter>
        {project.updatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

export function ProjectsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: projects, isLoading } = useProjects();

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold">Projects</h1>
        <Button onClick={() => setCreateOpen(true)}>Create Project</Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!projects || projects.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 max-w-[360px] mx-auto text-center">
          <FolderKanban className="size-12 text-muted-foreground" />
          <div>
            <h2 className="text-[20px] font-semibold mb-1">No projects yet</h2>
            <p className="text-sm text-muted-foreground">
              Create your first project to start managing tasks and sprints.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Create Project</Button>
        </div>
      )}

      {/* Project grid */}
      {!isLoading && projects && projects.length > 0 && (
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </FieldGroup>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
