import { useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, FileText, File, Image as ImageIcon, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/useAttachments';
import { api } from '@/lib/api';
import type { Attachment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('text/')) return FileText;
  if (mimeType.startsWith('image/')) return ImageIcon;
  return File;
}

interface AttachmentRowProps {
  attachment: Attachment;
  projectId: string;
  taskId: string;
  currentUserId: string;
  canManage: boolean;
  onDelete: (attachmentId: string) => void;
}

function AttachmentRow({
  attachment,
  projectId,
  taskId,
  currentUserId,
  canManage,
  onDelete,
}: AttachmentRowProps) {
  const canDelete = attachment.uploaderId === currentUserId || canManage;
  const FileIcon = getFileIcon(attachment.mimeType);
  const downloadUrl = api.getAttachmentDownloadUrl(projectId, taskId, attachment.id);

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true });
    } catch {
      return attachment.createdAt;
    }
  })();

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium truncate max-w-[240px] flex-1">
        {attachment.filename}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatFileSize(attachment.size)}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Avatar className="size-5">
          <AvatarFallback className="text-[8px]">
            {getInitials(attachment.uploader.username)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">{attachment.uploader.username}</span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{relativeTime}</span>
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        <Button variant="ghost" size="icon" className="size-7" asChild={false}>
          <Download className="size-3.5" />
          <span className="sr-only">Download {attachment.filename}</span>
        </Button>
      </a>
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 shrink-0">
              <Trash2 className="size-3.5" />
              <span className="sr-only">Delete {attachment.filename}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Attachment</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {attachment.filename}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onDelete(attachment.id)}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

interface AttachmentListProps {
  projectId: string;
  taskId: string;
  currentUserId: string;
  canManage: boolean;
}

export function AttachmentList({
  projectId,
  taskId,
  currentUserId,
  canManage,
}: AttachmentListProps) {
  const { data: attachments = [] } = useAttachments(projectId, taskId);
  const uploadAttachment = useUploadAttachment(projectId, taskId);
  const deleteAttachment = useDeleteAttachment(projectId, taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side 10 MB check
    if (file.size > 10_485_760) {
      toast.error('File is too large. Maximum size is 10 MB.');
      // Reset the input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    uploadAttachment.mutate(file, {
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  const handleDelete = (attachmentId: string) => {
    deleteAttachment.mutate(attachmentId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-muted-foreground">Attachments</h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          {uploadAttachment.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Attach file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          aria-label="Upload attachment"
          onChange={handleFileChange}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments.</p>
      ) : (
        <div>
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              projectId={projectId}
              taskId={taskId}
              currentUserId={currentUserId}
              canManage={canManage}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
