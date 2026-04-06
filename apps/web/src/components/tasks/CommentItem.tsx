import { formatDistanceToNow } from 'date-fns';
import { Trash2, Reply } from 'lucide-react';
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
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  canManage,
  onReply,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const canDelete = comment.authorId === currentUserId || canManage;

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
        <AvatarFallback className="text-[10px]">
          {getInitials(comment.author.username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{comment.author.username}</span>
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
        </div>
        <div
          className="prose prose-sm max-w-none mt-0.5 break-words text-sm [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_p]:my-0.5"
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="size-3" />
              Reply
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                >
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
