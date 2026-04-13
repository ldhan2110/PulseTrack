import { FileText, Image, File } from 'lucide-react';
import type { PlannerAttachment } from '@/lib/types';

function getIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface ChatAttachmentProps {
  attachment: PlannerAttachment;
}

export function ChatAttachment({ attachment }: ChatAttachmentProps) {
  const Icon = getIcon(attachment.mimeType);
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[150px]">{attachment.fileName}</span>
      <span className="text-muted-foreground">{formatSize(attachment.size)}</span>
    </div>
  );
}
