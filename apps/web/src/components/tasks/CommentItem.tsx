// apps/web/src/components/tasks/CommentItem.tsx
import { useState } from 'react';
import DOMPurify from 'dompurify';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Reply, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RichTextEditor } from './RichTextEditor';
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
import type { Comment } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  canManage: boolean;
  projectId: string;
  entityType?: 'task' | 'bug';
  entityId?: string;
  /** @deprecated Use entityId instead */
  taskId?: string;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  canManage,
  projectId,
  entityType = 'task',
  entityId,
  taskId,
  onReply,
  onDelete,
  onEdit,
}: CommentItemProps) {
  const resolvedEntityId = entityId ?? taskId ?? '';
  const canDelete = comment.authorId === currentUserId || canManage;
  const canEditComment = comment.authorId === currentUserId || canManage;
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
    } catch {
      return comment.createdAt;
    }
  })();

  return (
    <div className="flex gap-2 group/comment">
      <Avatar className="size-6 shrink-0 mt-0.5">
        {comment.author.imageUrl && <AvatarImage src={comment.author.imageUrl} alt={comment.author.name ?? comment.author.username} />}
        <AvatarFallback className="text-[10px]">
          {getInitials(comment.author.name ?? comment.author.username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{comment.author.name ?? comment.author.username}</span>
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
          {comment.isEdited && (
            <span className="text-xs text-muted-foreground italic">(edited)</span>
          )}
        </div>
        {isEditing ? (
          <div className="mt-1">
            <RichTextEditor
              initialContent={comment.content}
              onSave={(html) => {
                onEdit(comment.id, html);
                setIsEditing(false);
              }}
              editable={true}
              alwaysEditing={true}
              projectId={projectId}
              entityType={entityType}
              entityId={resolvedEntityId}
              placeholder="Edit comment..."
              onChange={(html) => setEditedContent(html)}
            />
            <div className="flex items-center gap-1 mt-1">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onEdit(comment.id, editedContent);
                  setIsEditing(false);
                }}
              >
                Update
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setEditedContent(comment.content);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none mt-0.5 break-words text-sm [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:text-xs [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-xs [&_th]:bg-muted [&_th]:font-semibold [&_.mention]:bg-blue-100 [&_.mention]:text-blue-800 [&_.mention]:dark:bg-blue-900/30 [&_.mention]:dark:text-blue-300 [&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:font-medium"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content, { ADD_ATTR: ['data-mention-id'] }) }}
          />
        )}
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => onReply(comment.id)}
          >
            <Reply className="size-3" />
            Reply
          </Button>
          {canEditComment && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6">
                  <Trash2 className="size-3" />
                  <span className="sr-only">Delete comment</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this comment. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDelete(comment.id)}
                  >
                    Delete Comment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
