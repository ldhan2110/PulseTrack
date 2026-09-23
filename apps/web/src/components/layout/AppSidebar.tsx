import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Zap,
  Bug,
  ClipboardList,
  Play,
  Users,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GanttChart,
  Settings,
  LogOut,
  CheckSquare,
  BookOpen,
  Target,
  ScanSearch,
  BarChart3,
  MessageSquare,
  Plus,
  UserCog,
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
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useProjects } from '@/hooks/useProjects';
import { useChatUnread } from '@/hooks/useChat';
import { useAuth } from '@/auth/useAuth';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { useUiStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionArea } from '@/lib/permissions';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  /** Permission area gating this item's `view`. Unset = always visible. */
  area?: PermissionArea;
  children?: NavItem[];
}

export const PROJECT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard', area: 'dashboard' },
  {
    label: 'Project Planner',
    icon: Target,
    path: 'planner',
    children: [
      { label: 'Scope Definition', icon: ScanSearch, path: 'planner', area: 'planner' },
      { label: 'WBS', icon: GanttChart, path: 'wbs', area: 'wbs' },
    ],
  },
  { label: 'Backlog', icon: ListTodo, path: 'backlog', area: 'tasks' },
  { label: 'Sprints', icon: Zap, path: 'sprints', area: 'sprints' },
  { label: 'Test Cases', icon: ClipboardList, path: 'test-cases', area: 'testCases' },
  { label: 'Test Executions', icon: Play, path: 'test-executions', area: 'testExecutions' },
  { label: 'Bugs', icon: Bug, path: 'bugs', area: 'bugs' },
  { label: 'Reports', icon: BarChart3, path: 'reports', area: 'report' },
  { label: 'Members & Groups', icon: Users, path: 'members', area: 'members' },
  { label: 'Wiki', icon: BookOpen, path: 'wiki', area: 'wiki' },
  { label: 'Settings', icon: Settings, path: 'settings', area: 'projectSettings' },
];

type CanFn = (area: string, action: string) => boolean;

/**
 * Keep only nav items the member may `view`. Leaf shown when it has no `area`
 * or `can(area,'view')`; a parent is kept only if ≥1 of its children survives.
 * Pure — returns new objects, never mutates PROJECT_NAV_ITEMS.
 */
export function filterNavByPermission(items: NavItem[], can: CanFn): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.children) {
      const children = item.children.filter((c) => !c.area || can(c.area as string, 'view'));
      if (children.length > 0) acc.push({ ...item, children });
      return acc;
    }
    if (!item.area || can(item.area as string, 'view')) acc.push(item);
    return acc;
  }, []);
}

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
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({ 'Project Planner': true });
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: projects } = useProjects();
  const chatUnread = useChatUnread();
  const { user, keycloakUserInfo, logout } = useAuth();
  const activeProjectId = useUiStore((s) => s.activeProjectId);

  const userName = keycloakUserInfo?.usrNm ?? user?.name ?? user?.username ?? user?.email ?? 'User';
  const userAvatarUrl = keycloakUserInfo?.imgUrl ?? user?.imageUrl ?? null;

  const userInitials = userName
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // Find active project to get its prefix for URL generation
  const activeProject = projects?.find((p) => p.id === activeProjectId);
  const activeProjectPrefix = activeProject?.prefix ?? activeProjectId ?? '';

  // Gate project nav items by the member's `view` permission (fail closed).
  const { can } = usePermissions(activeProjectId ?? '');
  const projectNavItems = filterNavByPermission(PROJECT_NAV_ITEMS, can);

  return (
    <Sidebar collapsible="icon">
      {/* Header: logo + collapse toggle */}
      <SidebarHeader className="h-12 flex items-center px-2">
        {isCollapsed ? (
          <div className="flex justify-center w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <img
                  src="/images/logo.png"
                  alt="CareOne"
                  className="size-8 shrink-0 cursor-pointer"
                  onClick={toggleSidebar}
                />
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src="/images/logo.png"
              alt="CareOne"
              className="size-8 shrink-0 cursor-pointer"
              onClick={() => navigate('/')}
            />
            <span
              className="font-extrabold text-lg tracking-tight truncate cursor-pointer flex-1"
              style={{ color: '#170F49' }}
              onClick={() => navigate('/')}
            >
              CareOne
            </span>
            <SidebarCollapseButton />
          </div>
        )}
      </SidebarHeader>

      <Separator />

      {/* Re-show the native scrollbar when nav overflows (base SidebarContent hides it via `no-scrollbar`) */}
      <SidebarContent className="[-ms-overflow-style:auto] [scrollbar-width:thin] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1.5">
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
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    isActive={location.pathname === '/chat'}
                    aria-label="Chat"
                    onClick={() => navigate('/chat')}
                    className="cursor-pointer"
                  >
                    <MessageSquare className="size-4" />
                    <span>Chat</span>
                    {chatUnread > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                        {chatUnread > 99 ? '99+' : chatUnread}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    Chat{chatUnread > 0 ? ` (${chatUnread})` : ''}
                  </TooltipContent>
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
          {/* Projects list — capped height, scrolls internally when overflowing (both expanded & collapsed) */}
          <div className="max-h-[240px] overflow-y-auto">
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
                            <img src={project.avatarUrl} alt={`${project.name} avatar`} className="size-4 shrink-0 rounded" />
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
            </SidebarMenu>
          </div>

          <SidebarMenu>
            {/* New Project button */}
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    aria-label="New Project"
                    onClick={onCreateProject}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-4" />
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
                {projectNavItems.map((item) => {
                  if (item.children) {
                    const isExpanded = expandedMenus[item.label] ?? false;
                    const childActive = item.children.some(
                      (child) => location.pathname === `/projects/${activeProjectPrefix}/${child.path}`,
                    );
                    return (
                      <div key={item.label}>
                        <SidebarMenuItem>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton
                                isActive={childActive}
                                aria-label={item.label}
                                onClick={() =>
                                  setExpandedMenus((prev) => ({
                                    ...prev,
                                    [item.label]: !prev[item.label],
                                  }))
                                }
                                className="cursor-pointer"
                              >
                                <item.icon />
                                <span className="flex-1">{item.label}</span>
                                {!isCollapsed && (
                                  <ChevronDown
                                    className={`size-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                                  />
                                )}
                              </SidebarMenuButton>
                            </TooltipTrigger>
                            {isCollapsed && (
                              <TooltipContent side="right">{item.label}</TooltipContent>
                            )}
                          </Tooltip>
                        </SidebarMenuItem>
                        {isExpanded && !isCollapsed && (
                          <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5">
                            {item.children.map((child) => {
                              const href = `/projects/${activeProjectPrefix}/${child.path}`;
                              const isActive = location.pathname === href;
                              return (
                                <SidebarMenuItem key={child.path}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <SidebarMenuButton
                                        isActive={isActive}
                                        aria-label={child.label}
                                        onClick={() => navigate(href)}
                                        className="cursor-pointer h-8 text-sm"
                                      >
                                        <child.icon className="size-3.5" />
                                        <span>{child.label}</span>
                                      </SidebarMenuButton>
                                    </TooltipTrigger>
                                  </Tooltip>
                                </SidebarMenuItem>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
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
                  aria-label="Profile"
                  onClick={() => setProfileOpen(true)}
                  className="size-8"
                >
                  <UserCog className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Profile</TooltipContent>
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
                  aria-label="Profile"
                  onClick={() => setProfileOpen(true)}
                  className="size-8 shrink-0"
                >
                  <UserCog className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Profile</TooltipContent>
            </Tooltip>
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
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </Sidebar>
  );
}

interface AppSidebarProps {
  onCreateProject?: () => void;
}

export function AppSidebar({ onCreateProject = () => {} }: AppSidebarProps) {
  return <AppSidebarInner onCreateProject={onCreateProject} />;
}
