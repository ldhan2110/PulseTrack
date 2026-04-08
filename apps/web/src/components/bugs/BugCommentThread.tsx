import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Reply, Trash2, Pencil, Loader2 } from 'lucide-react';
import {
  useBugComments,
  useCreateBugComment,
  useCreateBugReply,
  useDeleteBugComment,
  useUpdateBugComment,
} from '@/hooks/useBugComments';
import type { Comment } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

interface BugCommentThreadProps {
  projectId: string;
  bugId: string;
  currentUserId: string;
  canManage: boolean;
}

function CommentBubble({
  comment,
  currentUserId,
  canManage,
  onReply,
  onDelete,
  onEdit,
  isReply = false,
}: {
  comment: Comment;
  currentUserId: string;
  canManage: boolean;
  onReply?: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  isReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const canModify = comment.authorId === currentUserId || canManage;
  const authorName = (comment.author as any)?.name ?? (comment.author as any)?.username ?? 'Unknown';

  return (
    <div className="flex gap-3">
      <Avatar className="size-7 mt-0.5 shrink-0">
        {(comment.author as any)?.imageUrl && (
          <AvatarImage src={(comment.author as any).imageUrl} alt={authorName} />
        )}
        <AvatarFallback className="text-[10px]">{getInitials(authorName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{authorName}</span>
          <span className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</span>
          {comment.isEdited && <span className="text-xs text-muted-foreground italic">(edited)</span>}
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={2}
              className="text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => {
                  onEdit(comment.id, editValue);
                  setEditing(false);
                }}
                disabled={!editValue.trim()}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setEditValue(comment.content);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        )}
        {!editing && (
          <div className="flex items-center gap-1 mt-1">
            {!isReply && onReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground gap-1 px-1.5"
                onClick={() => onReply(comment.id)}
              >
                <Reply className="size-3" />
                Reply
              </Button>
            )}
            {canModify && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground gap-1 px-1.5"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground gap-1 px-1.5 hover:text-destructive"
                  onClick={() => onDelete(comment.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function BugCommentThread({
  projectId,
  bugId,
  currentUserId,
  canManage,
}: BugCommentThreadProps) {
  const { data: comments = [] } = useBugComments(projectId, bugId);
  const createComment = useCreateBugComment(projectId, bugId);
  const createReply = useCreateBugReply(projectId, bugId);
  const deleteComment = useDeleteBugComment(projectId, bugId);
  const updateComment = useUpdateBugComment(projectId, bugId);

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyValue, setReplyValue] = useState('');

  const handlePost = () => {
    if (!newComment.trim()) return;
    createComment.mutate(newComment.trim(), {
      onSuccess: () => setNewComment(''),
    });
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
    setReplyValue('');
  };

  const handlePostReply = (commentId: string) => {
    if (!replyValue.trim()) return;
    createReply.mutate(
      { commentId, content: replyValue.trim() },
      { onSuccess: () => { setReplyingTo(null); setReplyValue(''); } },
    );
  };

  const topLevelComments = comments.filter((c) => c.parentId === null);

  return (
    <div className="flex flex-col gap-4">
      {topLevelComments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {topLevelComments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 flex flex-col gap-2">
              <CommentBubble
                comment={comment}
                currentUserId={currentUserId}
                canManage={canManage}
                onReply={handleReply}
                onDelete={(id) => deleteComment.mutate(id)}
                onEdit={(id, content) => updateComment.mutate({ commentId: id, content })}
              />

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-5 border-l-2 border-border pl-4 flex flex-col gap-2">
                  {comment.replies.map((reply) => (
                    <CommentBubble
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      canManage={canManage}
                      onDelete={(id) => deleteComment.mutate(id)}
                      onEdit={(id, content) => updateComment.mutate({ commentId: id, content })}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Inline reply composer */}
              {replyingTo === comment.id && (
                <div className="ml-5 border-l-2 border-border pl-4">
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={replyValue}
                      onChange={(e) => setReplyValue(e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handlePostReply(comment.id)}
                        disabled={!replyValue.trim() || createReply.isPending}
                      >
                        {createReply.isPending && <Loader2 className="size-3 animate-spin mr-1" />}
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setReplyingTo(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New comment composer */}
      <div className="flex flex-col gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handlePost}
            disabled={!newComment.trim() || createComment.isPending}
          >
            {createComment.isPending && <Loader2 className="size-3 animate-spin mr-1" />}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
