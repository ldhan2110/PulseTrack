import { useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MembersTable } from '@/components/members/MembersTable';
import { AddMemberDialog } from '@/components/members/AddMemberDialog';
import { GroupsCard } from '@/components/settings/GroupsCard';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';

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
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { data: members, isLoading } = useMembers(projectId);
  const { can } = usePermissions(projectId);
  const canManage = can('members', 'update');
  const canAdd = can('members', 'create');
  const canManageGroups = can('projectSettings', 'update');

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Members &amp; Groups</h1>
        {canAdd && (
          <Button onClick={() => setAddDialogOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Add Member
          </Button>
        )}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
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
              {canAdd && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <UserPlus data-icon="inline-start" />
                  Add Member
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <GroupsCard projectId={projectId} canManage={canManageGroups} />
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <AddMemberDialog
        projectId={projectId ?? ''}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
