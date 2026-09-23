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
            Hides the project from everyone, including members. Tasks, bugs, and other data are
            kept but become inaccessible. Recovery is possible only by an administrator via the
            database.
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
                This hides the project from all members and you. Its tasks, bugs, sprints and
                other data are preserved but will no longer be reachable in the app.
                <span className="mt-2 block font-medium text-destructive">
                  This cannot be undone from the app — only an administrator can restore it.
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
