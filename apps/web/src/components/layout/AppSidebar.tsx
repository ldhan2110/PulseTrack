import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Zap,
  Bug,
  Users,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const PROJECT_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Backlog', icon: ListTodo, path: 'backlog' },
  { label: 'Sprints', icon: Zap, path: 'sprints' },
  { label: 'Bugs', icon: Bug, path: 'bugs' },
  { label: 'Members', icon: Users, path: 'members' },
];

function SidebarCollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebar}
          className="size-8"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}

interface AppSidebarInnerProps {
  onCreateProject: () => void;
}

function AppSidebarInner({ onCreateProject }: AppSidebarInnerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { data: projects } = useProjects();
  const { user } = useAuth();
  const activeProjectId = useUiStore((s) => s.activeProjectId);

  const userInitials = user?.username
    ? user.username.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const userName = user?.username ?? user?.email ?? 'User';

  return (
    <Sidebar collapsible="icon">
      {/* Header: PM logo */}
      <SidebarHeader className="h-12 flex items-center px-3">
        <div className={cn('flex items-center gap-2', isCollapsed && 'justify-center')}>
          <FolderKanban className="size-5 text-primary shrink-0" />
          {!isCollapsed && (
            <span className="font-semibold text-base tracking-tight">PM</span>
          )}
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent className="overflow-hidden">
        {/* Projects section */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[13px] font-semibold">
              Projects
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {(projects ?? []).map((project) => {
              const isActive = location.pathname.startsWith(`/projects/${project.id}`);
              return (
                <SidebarMenuItem key={project.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={isActive}
                        aria-label={project.name}
                        onClick={() => navigate(`/projects/${project.id}/dashboard`)}
                        className="cursor-pointer"
                      >
                        <FolderKanban />
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">{project.name}</TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              );
            })}

            {/* New Project button */}
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    aria-label="New Project"
                    onClick={onCreateProject}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-medium">+</span>
                    {!isCollapsed && <span>New Project</span>}
                  </SidebarMenuButton>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">New Project</TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Project nav section (visible when inside a project) */}
        {activeProjectId && (
          <>
            <Separator />
            <SidebarGroup>
              {!isCollapsed && (
                <SidebarGroupLabel className="text-[13px] font-semibold truncate">
                  {projects?.find((p) => p.id === activeProjectId)?.name ?? 'Project'}
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {PROJECT_NAV_ITEMS.map((item) => {
                  const href = `/projects/${activeProjectId}/${item.path}`;
                  const isActive = location.pathname === href;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            aria-label={item.label}
                            onClick={() => navigate(href)}
                            className="cursor-pointer"
                          >
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="h-12">
        <Separator />
        <div
          className={cn(
            'flex items-center px-3 h-12',
            isCollapsed ? 'justify-center' : 'gap-2',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="size-7 shrink-0 cursor-default">
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">{userName}</TooltipContent>
            )}
          </Tooltip>
          {!isCollapsed && (
            <span className="text-sm truncate text-sidebar-foreground">{userName}</span>
          )}
          {!isCollapsed && (
            <div className="ml-auto">
              <SidebarCollapseButton />
            </div>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center pb-1">
            <SidebarCollapseButton />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

interface AppSidebarProps {
  onCreateProject?: () => void;
}

export function AppSidebar({ onCreateProject = () => {} }: AppSidebarProps) {
  return <AppSidebarInner onCreateProject={onCreateProject} />;
}
