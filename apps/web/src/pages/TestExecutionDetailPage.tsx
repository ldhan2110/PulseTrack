import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useTestExecutionByKey,
  useDeleteTestExecution,
} from '@/hooks/useTestExecutions';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { ExecutionDetail } from '@/components/test-executions/ExecutionDetail';
import { ExecutionRunner } from '@/components/test-executions/ExecutionRunner';

export function TestExecutionDetailPage() {
  const { executionKey = '', projectPrefix = '' } = useParams<{
    executionKey: string;
    projectPrefix: string;
  }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();

  const { data: execution, isLoading, isError } = useTestExecutionByKey(projectId, executionKey);
  const { data: members = [] } = useMembers(projectId);
  const { can } = usePermissions(projectId);
  const canManage = can('testExecutions', 'update');
  const deleteExecution = useDeleteTestExecution(projectId);

  const [runnerMode, setRunnerMode] = useState(false);
  const [runnerCaseIndex, setRunnerCaseIndex] = useState(0);

  const handleDelete = () => {
    if (!execution) return;
    deleteExecution.mutate(execution.id, {
      onSuccess: () => navigate(`/projects/${projectPrefix}/test-executions`),
    });
  };

  const goBack = () => navigate(`/projects/${projectPrefix}/test-executions`);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error / Not found state
  if (isError || !execution) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <p className="text-sm text-muted-foreground">
            This test execution doesn't exist or has been deleted.
          </p>
          <Link
            to={`/projects/${projectPrefix}/test-executions`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Test Executions
          </Link>
        </div>
      </div>
    );
  }

  // Runner view
  if (runnerMode && execution.cases) {
    return (
      <ExecutionRunner
        projectId={projectId}
        executionCases={execution.cases}
        executionName={execution.name}
        initialCaseIndex={runnerCaseIndex}
        onBack={() => setRunnerMode(false)}
        members={members}
      />
    );
  }

  return (
    <ExecutionDetail
      projectId={projectId}
      execution={execution}
      onStartRunner={(idx) => {
        setRunnerCaseIndex(idx);
        setRunnerMode(true);
      }}
      onBack={goBack}
      members={members}
      deleteButton={
        canManage ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Test Execution</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this test execution and all its results. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete Execution
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : undefined
      }
    />
  );
}
