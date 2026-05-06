import type { TestExecution, Member } from '@/lib/types';
import type { ReactNode } from 'react';

interface ExecutionDetailProps {
  projectId: string;
  execution: TestExecution;
  onStartRunner: (idx: number) => void;
  onBack: () => void;
  members: Member[];
  deleteButton?: ReactNode;
}

// TODO: implement
export function ExecutionDetail(_props: ExecutionDetailProps) {
  return <div>ExecutionDetail placeholder</div>;
}
