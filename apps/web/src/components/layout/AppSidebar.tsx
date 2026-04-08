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
  Settings,
  LogOut,
  CheckSquare,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';

const PROJECT_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Backlog', icon: ListTodo, path: 'backlog' },
  { label: 'Sprints', icon: Zap, path: 'sprints' },
  { label: 'Bugs', icon: Bug, path: 'bugs' },
  { label: 'Members', icon: Users, path: 'members' },
  { label: 'Settings', icon: Settings, path: 'settings' },
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
          className="size-8 shrink-0"
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
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { data: projects } = useProjects();
  const { user, keycloakUserInfo, logout } = useAuth();
  const activeProjectId = useUiStore((s) => s.activeProjectId);

  const userName = keycloakUserInfo?.usrNm ?? user?.username ?? user?.email ?? 'User';
  const userAvatarUrl = keycloakUserInfo?.imgUrl ?? null;

  const userInitials = userName
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // Find active project to get its prefix for URL generation
  const activeProject = projects?.find((p) => p.id === activeProjectId);
  const activeProjectPrefix = activeProject?.prefix ?? activeProjectId ?? '';

  return (
    <Sidebar collapsible="icon">
      {/* Header: logo + collapse toggle */}
      <SidebarHeader className="h-12 flex items-center px-2">
        {isCollapsed ? (
          <div className="flex justify-center w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <img
                  src="/favicon.svg"
                  alt="Logo"
                  className="size-6 shrink-0 cursor-pointer"
                  onClick={toggleSidebar}
                />
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src="/favicon.svg"
              alt="Logo"
              className="size-6 shrink-0 cursor-pointer"
              onClick={() => navigate('/')}
            />
            <span
              className="font-semibold text-base tracking-tight truncate cursor-pointer flex-1"
              onClick={() => navigate('/')}
            >
              PulseTrack
            </span>
            <SidebarCollapseButton />
          </div>
        )}
      </SidebarHeader>

      <Separator />

      <SidebarContent className="overflow-hidden">
        {/* My Tasks — top-level nav */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    isActive={location.pathname === '/my-tasks'}
                    aria-label="My Tasks"
                    onClick={() => navigate('/my-tasks')}
                    className="cursor-pointer"
                  >
                    <CheckSquare className="size-4" />
                    <span>My Tasks</span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">My Tasks</TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <Separator />

        {/* Projects section */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[13px] font-semibold">
              Projects
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {(projects ?? []).map((project) => {
              const projectIdentifier = project.prefix ?? project.id;
              const isActive = location.pathname.startsWith(`/projects/${projectIdentifier}`);
              return (
                <SidebarMenuItem key={project.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={isActive}
                        aria-label={project.name}
                        onClick={() => navigate(`/projects/${projectIdentifier}/dashboard`)}
                        className="cursor-pointer"
                      >
                        {project.avatarUrl ? (
                          <img src={project.avatarUrl} alt={`${project.name} avatar`} className="size-4 rounded" />
                        ) : (
                          <FolderKanban className="size-4" />
                        )}
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
                  {activeProject?.name ?? 'Project'}
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {PROJECT_NAV_ITEMS.map((item) => {
                  const href = `/projects/${activeProjectPrefix}/${item.path}`;
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

      {/* Footer: user info + logout */}
      <SidebarFooter>
        <Separator />
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="size-7 cursor-default">
                  {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">{userName}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  onClick={logout}
                  className="size-8"
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 h-12">
            <Avatar className="size-7 shrink-0 cursor-default">
              {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
              <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
            </Avatar>
            <span className="text-sm truncate text-sidebar-foreground flex-1">{userName}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  onClick={logout}
                  className="size-8 shrink-0"
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
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
