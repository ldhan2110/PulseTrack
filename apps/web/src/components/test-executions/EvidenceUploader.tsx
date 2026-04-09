import { useRef } from 'react';
import { Paperclip, Download, Trash2, FileImage, FileText, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadExecutionEvidence, useDeleteExecutionEvidence } from '@/hooks/useTestExecutions';
import { api } from '@/lib/api';
import type { TestExecutionAttachment } from '@/lib/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <FileImage className="size-4 text-muted-foreground" />;
  if (mimeType.startsWith('video/')) return <Film className="size-4 text-muted-foreground" />;
  if (mimeType === 'application/pdf') return <FileText className="size-4 text-muted-foreground" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

const ACCEPT = 'image/*,application/pdf,video/*';

interface EvidenceUploaderProps {
  projectId: string;
  executionCaseId: string;
  attachments: TestExecutionAttachment[];
  onUploadComplete?: () => void;
}

export function EvidenceUploader({
  projectId,
  executionCaseId,
  attachments,
  onUploadComplete,
}: EvidenceUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadExecutionEvidence(projectId);
  const deleteEvidence = useDeleteExecutionEvidence(projectId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    upload.mutate(
      { executionCaseId, file },
      {
        onSuccess: () => {
          onUploadComplete?.();
        },
      },
    );

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Paperclip className="size-3.5" />
          {upload.isPending ? 'Uploading...' : 'Upload Evidence'}
        </Button>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              {isImageMime(att.mimeType) ? (
                <img
                  src={api.getExecutionEvidenceDownloadUrl(projectId, att.id)}
                  alt={att.filename}
                  className="size-8 rounded object-cover shrink-0"
                />
              ) : (
                <FileIcon mimeType={att.mimeType} />
              )}
              <span className="truncate flex-1">{att.filename}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatFileSize(att.size)}
              </span>
              {att.uploader && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {att.uploader.name ?? att.uploader.username}
                </span>
              )}
              <a
                href={api.getExecutionEvidenceDownloadUrl(projectId, att.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button type="button" variant="ghost" size="sm" className="size-6 p-0">
                  <Download className="size-3.5" />
                </Button>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-6 p-0 text-destructive hover:text-destructive"
                onClick={() => deleteEvidence.mutate(att.id)}
                disabled={deleteEvidence.isPending}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
