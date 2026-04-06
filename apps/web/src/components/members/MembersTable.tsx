import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useChangeMemberRole, useRemoveMember } from '@/hooks/useMembers';
import type { Member, ProjectRole } from '@/lib/types';

const ROLES: ProjectRole[] = ['pm', 'ba', 'qc', 'developer'];

const ROLE_LABELS: Record<ProjectRole, string> = {
  pm: 'PM',
  ba: 'BA',
  qc: 'QC',
  developer: 'Developer',
};

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface MembersTableProps {
  members: Member[];
  projectId: string;
  canManage: boolean;
}

export function MembersTable({ members, projectId, canManage }: MembersTableProps) {
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const changeMemberRole = useChangeMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);

  const handleRemoveConfirm = () => {
    if (!removingMember) return;
    removeMember.mutate(
      { memberId: removingMember.id, name: removingMember.user.username },
      { onSettled: () => setRemovingMember(null) },
    );
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManage && <TableHead className="w-16"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{getInitials(member.user.username)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{member.user.username}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {member.user.email}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
              </TableCell>
              {canManage && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                        <span className="sr-only">Member actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        {ROLES.map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onSelect={() =>
                              changeMemberRole.mutate({ memberId: member.id, data: { role } })
                            }
                          >
                            {ROLE_LABELS[role]}
                            {member.role === role && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                Current
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setRemovingMember(member)}
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removingMember?.user.username} from this project? They will lose access to
              all project data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveConfirm}
              disabled={removeMember.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
