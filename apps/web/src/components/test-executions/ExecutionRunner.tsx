import type { Member } from '@/lib/types';

interface ExecutionRunnerProps {
  projectId: string;
  executionCases: unknown[];
  executionName?: string;
  initialCaseIndex: number;
  onBack: () => void;
  members: Member[];
}

// TODO: implement
export function ExecutionRunner(_props: ExecutionRunnerProps) {
  return <div>ExecutionRunner placeholder</div>;
}
