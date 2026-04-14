import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, FileText, Film, File, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useUploadBugAttachment, useDeleteBugAttachment } from '@/hooks/useBugAttachments';
import { api } from '@/lib/api';
import type { BugAttachment } from '@/lib/types';
import { BugEvidencePreviewModal, isPreviewable } from './BugEvidencePreviewModal';

interface BugAttachmentsProps {
  projectId: string;
  bugId: string;
  attachments: BugAttachment[];
  canEdit: boolean;
}

function fileIcon(mimeType: string) {
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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

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

  const previewableAttachments = attachments.filter((a) => isPreviewable(a.mimeType));
  const nonPreviewable = attachments.filter((a) => !isPreviewable(a.mimeType));

  const openPreview = (attachment: BugAttachment) => {
    const idx = previewableAttachments.findIndex((a) => a.id === attachment.id);
    if (idx >= 0) setPreviewIndex(idx);
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

      {/* Thumbnail grid for previewable attachments */}
      {previewableAttachments.length > 0 && (
        <div className="grid grid-cols-[repeat(4,minmax(0,60px))] gap-1.5">
          {previewableAttachments.map((att) => {
            const staticUrl = `/api/uploads/bugs/${bugId}/${att.storedName}`;
            const isImage = att.mimeType.startsWith('image/');
            const isVideo = att.mimeType.startsWith('video/');

            return (
              <div
                key={att.id}
                className="relative group rounded border overflow-hidden cursor-pointer bg-muted/30 aspect-square max-w-15"
                onClick={() => openPreview(att)}
              >
                {isImage && (
                  <img
                    src={staticUrl}
                    alt={att.filename}
                    className="w-full h-full object-cover"
                  />
                )}
                {isVideo && (
                  <div className="relative w-full h-full bg-black/5 flex items-center justify-center">
                    <video
                      src={staticUrl}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="size-5 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="size-2.5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
                {att.mimeType === 'application/pdf' && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <FileText className="size-4" />
                    <span className="text-[7px] truncate max-w-full px-0.5 leading-tight">{att.filename}</span>
                  </div>
                )}

                {/* Hover overlay with filename & delete */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[8px] text-white truncate block leading-tight">{att.filename}</span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAttachment.mutate(att.id);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Chip list for non-previewable files */}
      {nonPreviewable.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {nonPreviewable.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer hover:bg-muted/50"
              onClick={() => { void handleDownload(att); }}
            >
              {fileIcon(att.mimeType)}
              <span className="truncate max-w-35">{att.filename}</span>
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

      <BugEvidencePreviewModal
        attachments={attachments}
        currentIndex={previewIndex ?? 0}
        projectId={projectId}
        bugId={bugId}
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        onNavigate={setPreviewIndex}
      />
    </div>
  );
}
