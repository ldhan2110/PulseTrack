import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { WbsTreePreview } from './WbsTreePreview';
import { WizardChatPanel } from './WizardChatPanel';
import type { ChatMessage } from './WizardChatPanel';

interface WizardPreviewChatProps {
  projectId: string;
  phases: any[];
  onPhasesUpdate: (phases: any[]) => void;
  onImport: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export function WizardPreviewChat({
  projectId,
  phases,
  onPhasesUpdate,
  onImport,
  onCancel,
  isImporting,
}: WizardPreviewChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `I've generated a WBS with ${phases.length} phase${phases.length !== 1 ? 's' : ''}. What would you like to adjust?`,
    },
  ]);

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.wbsChat(projectId, {
        message,
        currentWbs: phases,
        chatHistory: messages,
      }),
    onSuccess: (data) => {
      onPhasesUpdate(data.phases);
      const updatedPhases: any[] = data.phases;
      const totalTasks = updatedPhases.reduce(
        (acc, p) => acc + (p.tasks?.length ?? 0),
        0,
      );
      const totalSubtasks = updatedPhases.reduce(
        (acc, p) =>
          acc +
          (p.tasks ?? []).reduce(
            (a: number, t: any) => a + (t.subtasks?.length ?? 0),
            0,
          ),
        0,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Updated! Now ${updatedPhases.length} phase${updatedPhases.length !== 1 ? 's' : ''}, ${totalTasks} task${totalTasks !== 1 ? 's' : ''}, ${totalSubtasks} subtask${totalSubtasks !== 1 ? 's' : ''}.`,
        },
      ]);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message ?? 'Something went wrong. Please try again.';
      toast.error(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
      ]);
    },
  });

  const handleSend = (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    chatMutation.mutate(message);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Split layout */}
      <div className="flex-1 grid grid-cols-[1fr_350px] overflow-hidden">
        {/* Left: tree preview */}
        <div className="overflow-hidden">
          <WbsTreePreview phases={phases} />
        </div>

        {/* Right: chat panel */}
        <div className="overflow-hidden">
          <WizardChatPanel
            messages={messages}
            onSend={handleSend}
            isLoading={chatMutation.isPending}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
        <Button type="button" onClick={onImport} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import to WBS'}
        </Button>
      </div>
    </div>
  );
}
