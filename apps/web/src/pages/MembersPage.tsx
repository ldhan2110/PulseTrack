import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MembersTable } from '@/components/members/MembersTable';
import { AddMemberDialog } from '@/components/members/AddMemberDialog';
import { useMembers } from '@/hooks/useMembers';
import { useProjectRole } from '@/hooks/useProjectRole';

function MembersTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function MembersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { data: members, isLoading } = useMembers(projectId ?? '');
  const { canManage } = useProjectRole(projectId ?? '');

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Members</h1>
        {canManage && (
          <Button onClick={() => setAddDialogOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Add Member
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <MembersTableSkeleton />
      ) : members && members.length > 0 ? (
        <MembersTable
          members={members}
          projectId={projectId ?? ''}
          canManage={canManage}
        />
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Users className="size-12 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-base font-semibold">Just you for now</h2>
            <p className="max-w-[360px] text-sm text-muted-foreground">
              Add team members to collaborate on this project.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setAddDialogOpen(true)}>
              <UserPlus data-icon="inline-start" />
              Add Member
            </Button>
          )}
        </div>
      )}

      {/* Add Member Dialog */}
      <AddMemberDialog
        projectId={projectId ?? ''}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
