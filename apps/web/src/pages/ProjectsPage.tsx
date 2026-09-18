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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects } from '@/hooks/useProjects';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import type { ProjectListItem } from '@/lib/types';

// FieldGroup composition per shadcn skill rules
function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

const MAX_AVATARS = 4;

function ProjectCard({ project }: { project: ProjectListItem }) {
  const navigate = useNavigate();

  const role = project.userRole;
  const taskCount = project.taskSummary?.total ?? 0;
  const members = project.members ?? [];
  const shown = members.slice(0, MAX_AVATARS);
  const overflow = members.length - shown.length;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/projects/${project.prefix}/dashboard`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="shrink-0 rounded-lg after:hidden">
            {project.avatarUrl && <AvatarImage src={project.avatarUrl} alt={project.name} />}
            <AvatarFallback className="rounded-lg">
              <FolderKanban className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-sm text-muted-foreground">
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </div>
      </CardContent>
      <CardFooter className="mt-auto justify-end">
        <AvatarGroup>
          {shown.map((m) => (
            <Avatar key={m.user.id} size="sm">
              {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? ''} />}
              <AvatarFallback>{initials(m.user.name)}</AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
        </AvatarGroup>
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
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-lg shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
              <CardFooter className="mt-auto justify-end">
                <div className="flex -space-x-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="size-6 rounded-full" />
                </div>
              </CardFooter>
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
