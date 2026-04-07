import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { Settings, Upload, X } from 'lucide-react';
import { useProject, useUpdateProjectSettings, useUploadProjectAvatar, useRemoveProjectAvatar } from '@/hooks/useProjects';
import { useProjectRole } from '@/hooks/useProjectRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';

export function ProjectSettingsPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data: project, isLoading } = useProject(projectId);
  const { canManage } = useProjectRole(projectId);
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
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
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

          <Card>
            <CardHeader>
              <CardTitle>Task Key Prefix</CardTitle>
              <CardDescription>
                Tasks will be numbered {prefix || 'XX'}-1, {prefix || 'XX'}-2, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => validatePrefix(e.target.value)}
                placeholder="e.g. PM, ACME"
                className="max-w-xs"
                disabled={!canManage}
              />
              {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
              {prefix && !prefixError && (
                <p className="text-xs text-muted-foreground">
                  Preview: {prefix}-1, {prefix}-2, {prefix}-3...
                </p>
              )}
            </CardContent>
          </Card>

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
        </TabsContent>

        {canManage && (
          <TabsContent value="workflow" className="mt-6">
            <WorkflowEditor projectId={projectId} canManage={canManage} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
