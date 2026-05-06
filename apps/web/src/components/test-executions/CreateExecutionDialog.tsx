import type { Member } from '@/lib/types';

interface CreateExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: Member[];
}

// TODO: implement
export function CreateExecutionDialog(_props: CreateExecutionDialogProps) {
  return null;
}
