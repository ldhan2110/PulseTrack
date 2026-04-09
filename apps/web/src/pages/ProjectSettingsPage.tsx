import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { Settings, Upload, X } from 'lucide-react';
import { useProject, useUpdateProjectSettings, useUploadProjectAvatar, useRemoveProjectAvatar } from '@/hooks/useProjects';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';
import { RepositorySettingsCard } from '@/components/settings/RepositorySettingsCard';
import { AiConfigCard } from '@/components/settings/AiConfigCard';
import { RolesPermissionsTab } from '@/components/settings/RolesPermissionsTab';

export function ProjectSettingsPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data: project, isLoading } = useProject(projectId);
  const { can } = usePermissions(projectId);
  const canManage = can('projectSettings', 'update');
  const updateSettings = useUpdateProjectSettings(projectId);
  const uploadAvatar = useUploadProjectAvatar(projectId);
  const removeAvatar = useRemoveProjectAvatar(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'general';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prefix, setPrefix] = useState('');
  const [prefixError, setPrefixError] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (project && !initialized) {
    setName(project.name);
    setDescription(project.description ?? '');
    setPrefix(project.prefix ?? '');
    setInitialized(true);
  }

  if (isLoading) return null;
  if (!project) return <p className="text-sm text-muted-foreground">Project not found.</p>;

  const validatePrefix = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z]/g, '');
    setPrefix(upper);
    if (upper && !/^[A-Z]{2,10}$/.test(upper)) {
      setPrefixError('Must be 2-10 uppercase letters');
    } else {
      setPrefixError('');
    }
  };

  const handleSave = () => {
    if (prefixError) return;
    const payload: Record<string, string | undefined> = {};
    if (name !== project.name) payload.name = name;
    if (description !== (project.description ?? '')) payload.description = description;
    if (prefix !== (project.prefix ?? '')) payload.prefix = prefix;
    if (Object.keys(payload).length > 0) {
      updateSettings.mutate(payload);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Project Settings</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams({ tab })}
      >
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {canManage && <TabsTrigger value="workflow">Workflow</TabsTrigger>}
          {can('members', 'update') && <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          {/* Avatar Card */}
          <Card>
            <CardHeader>
              <CardTitle>Project Avatar</CardTitle>
              <CardDescription>Upload an image to represent this project</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <Avatar className="size-20">
                <AvatarImage
                  className="object-cover w-full h-full"
                  src={project.avatarUrl ?? undefined}
                  alt="Project Avatar"
                />
                <AvatarFallback className="text-2xl">
                  {project.prefix?.slice(0, 2) ?? project.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canManage || uploadAvatar.isPending}
                >
                  <Upload className="size-4 mr-1" />
                  Upload
                </Button>
                {project.avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAvatar.mutate()}
                    disabled={!canManage || removeAvatar.isPending}
                  >
                    <X className="size-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* General Card (now includes Task Key Prefix) */}
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="max-w-md"
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="max-w-md"
                  rows={3}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix">Task Key Prefix</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="prefix"
                    value={prefix}
                    onChange={(e) => validatePrefix(e.target.value)}
                    placeholder="e.g. PM, ACME"
                    className="max-w-30"
                    disabled={!canManage}
                  />
                  {prefix && !prefixError && (
                    <span className="text-xs text-muted-foreground">
                      Preview: {prefix}-1, {prefix}-2, {prefix}-3...
                    </span>
                  )}
                </div>
                {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
              </div>
            </CardContent>
          </Card>

          {canManage && (
            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending || !!prefixError}
            >
              Save Changes
            </Button>
          )}

          {/* Email Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Send email notifications to watchers and mentioned users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable email notifications</p>
                  <p className="text-xs text-muted-foreground">Watchers and mentioned users will receive emails for ticket updates</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={project.emailNotificationsEnabled ?? false}
                  onChange={(e) => {
                    updateSettings.mutate({ emailNotificationsEnabled: e.target.checked });
                  }}
                  disabled={!canManage}
                />
              </div>
            </CardContent>
          </Card>

          {/* Repository Settings Card */}
          <RepositorySettingsCard projectId={projectId} canManage={canManage} />

          {/* AI Configuration Card */}
          <AiConfigCard projectId={projectId} canManage={canManage} />
        </TabsContent>

        {canManage && (
          <TabsContent value="workflow" className="mt-6">
            <Tabs defaultValue="TASK">
              <TabsList>
                <TabsTrigger value="TASK">Task Workflow</TabsTrigger>
                <TabsTrigger value="BUG">Bug Workflow</TabsTrigger>
              </TabsList>
              <TabsContent value="TASK" className="mt-4">
                <WorkflowEditor projectId={projectId} canManage={canManage} kind="TASK" />
              </TabsContent>
              <TabsContent value="BUG" className="mt-4">
                <WorkflowEditor projectId={projectId} canManage={canManage} kind="BUG" />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        {can('members', 'update') && (
          <TabsContent value="roles" className="mt-6">
            <RolesPermissionsTab projectId={projectId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
