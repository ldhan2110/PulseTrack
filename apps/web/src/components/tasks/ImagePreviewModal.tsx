// apps/web/src/components/tasks/ImagePreviewModal.tsx
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Attachment } from '@/lib/types';

interface ImagePreviewModalProps {
  attachment: Attachment | null;
  projectId: string;
  taskId: string;
  open: boolean;
  onClose: () => void;
}

export function ImagePreviewModal({
  attachment,
  projectId,
  taskId,
  open,
  onClose,
}: ImagePreviewModalProps) {
  if (!attachment) return null;

  const staticUrl = `/api/uploads/tasks/${taskId}/${attachment.storedName}`;

  const handleDownload = async () => {
    try {
      const blob = await api.downloadAttachment(projectId, taskId, attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[90vw] w-fit flex flex-col items-center gap-4 p-6">
        <DialogTitle className="text-sm font-medium truncate max-w-[80vw]">
          {attachment.filename}
        </DialogTitle>
        <img
          src={staticUrl}
          alt={attachment.filename}
          className="max-w-[85vw] max-h-[70vh] object-contain rounded-md"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <Button variant="outline" size="sm" onClick={() => { void handleDownload(); }} className="gap-2">
          <Download className="size-3.5" />
          Download
        </Button>
      </DialogContent>
    </Dialog>
  );
}
