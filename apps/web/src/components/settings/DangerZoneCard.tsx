import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';
import { useDeleteProject } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DangerZoneCardProps {
  projectId: string;
  projectName: string;
  ownerId: string | null;
}

export function DangerZoneCard({ projectId, projectName, ownerId }: DangerZoneCardProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const deleteProject = useDeleteProject();

  // Owner only — a non-owner never sees this card (absent, not disabled).
  if (!user?.id || user.id !== ownerId) return null;

  const handleDelete = () => {
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        toast.success('Project deleted');
        setActiveProjectId(null);
        navigate('/');
      },
    });
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>Irreversible actions for this project.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-6">
        <div className="max-w-[70%]">
          <p className="font-medium">Delete this project</p>
          <p className="text-sm text-muted-foreground">
            Removes the project for all members. Data is retained but inaccessible; only an
            administrator can restore it.
          </p>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Delete project
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{projectName}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The project will be removed for you and all members. Its data is retained but no
                longer accessible in the app.
                <span className="mt-2 block font-medium text-destructive">
                  This can’t be undone here — only an administrator can restore it.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteProject.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteProject.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                {deleteProject.isPending ? 'Deleting…' : 'Delete project'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
