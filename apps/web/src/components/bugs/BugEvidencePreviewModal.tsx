import { useCallback, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { BugAttachment } from '@/lib/types';

function isImage(mime: string) {
  return mime.startsWith('image/');
}
function isVideo(mime: string) {
  return mime.startsWith('video/');
}
function isPdf(mime: string) {
  return mime === 'application/pdf';
}
export function isPreviewable(mime: string) {
  return isImage(mime) || isVideo(mime) || isPdf(mime);
}

interface BugEvidencePreviewModalProps {
  attachments: BugAttachment[];
  currentIndex: number;
  projectId: string;
  bugId: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function BugEvidencePreviewModal({
  attachments,
  currentIndex,
  projectId,
  bugId,
  open,
  onClose,
  onNavigate,
}: BugEvidencePreviewModalProps) {
  const previewable = attachments.filter((a) => isPreviewable(a.mimeType));
  const attachment = previewable[currentIndex];

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < previewable.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, goPrev, goNext]);

  if (!attachment) return null;

  const staticUrl = `/api/uploads/bugs/${bugId}/${attachment.storedName}`;

  const handleDownload = async () => {
    try {
      const blob = await api.downloadBugAttachment(projectId, bugId, attachment.id);
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
      <DialogContent className="max-w-[95vw] w-fit max-h-[95vh] flex flex-col items-center gap-4 p-6">
        <DialogTitle className="text-sm font-medium truncate max-w-[80vw]">
          {attachment.filename}
          {previewable.length > 1 && (
            <span className="text-muted-foreground ml-2 font-normal">
              ({currentIndex + 1} / {previewable.length})
            </span>
          )}
        </DialogTitle>

        <div className="relative flex items-center justify-center w-full min-h-[200px]">
          {hasPrev && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 z-10 size-8 rounded-full"
              onClick={goPrev}
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}

          <div className="flex items-center justify-center px-10">
            {isImage(attachment.mimeType) && (
              <img
                src={staticUrl}
                alt={attachment.filename}
                className="max-w-[90vw] max-h-[82vh] object-contain rounded-md"
              />
            )}
            {isVideo(attachment.mimeType) && (
              <video
                key={attachment.id}
                src={staticUrl}
                controls
                className="max-w-[90vw] max-h-[82vh] rounded-md"
              >
                Your browser does not support the video tag.
              </video>
            )}
            {isPdf(attachment.mimeType) && (
              <iframe
                src={staticUrl}
                title={attachment.filename}
                className="w-[90vw] h-[82vh] rounded-md border"
              />
            )}
          </div>

          {hasNext && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 z-10 size-8 rounded-full"
              onClick={goNext}
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => { void handleDownload(); }} className="gap-2">
          <Download className="size-3.5" />
          Download
        </Button>
      </DialogContent>
    </Dialog>
  );
}
