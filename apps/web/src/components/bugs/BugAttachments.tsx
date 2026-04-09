import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, FileText, Image, Film, File } from 'lucide-react';
import { toast } from 'sonner';
import { useUploadBugAttachment, useDeleteBugAttachment } from '@/hooks/useBugAttachments';
import { api } from '@/lib/api';
import type { BugAttachment } from '@/lib/types';

interface BugAttachmentsProps {
  projectId: string;
  bugId: string;
  attachments: BugAttachment[];
  canEdit: boolean;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="size-3.5 text-primary" />;
  if (mimeType.startsWith('video/')) return <Film className="size-3.5 text-primary" />;
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('har'))
    return <FileText className="size-3.5 text-primary" />;
  return <File className="size-3.5 text-primary" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BugAttachments({ projectId, bugId, attachments, canEdit }: BugAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBugAttachment(projectId, bugId);
  const deleteAttachment = useDeleteBugAttachment(projectId, bugId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      upload.mutate(file);
      e.target.value = '';
    }
  };

  const handleDownload = async (attachment: BugAttachment) => {
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-muted-foreground">Evidence</h2>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            >
              <Plus className="size-3" />
              {upload.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        )}
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer hover:bg-muted/50"
              onClick={() => { void handleDownload(att); }}
            >
              {fileIcon(att.mimeType)}
              <span className="truncate max-w-[140px]">{att.filename}</span>
              <span className="text-muted-foreground">{formatSize(att.size)}</span>
              {canEdit && (
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAttachment.mutate(att.id);
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
