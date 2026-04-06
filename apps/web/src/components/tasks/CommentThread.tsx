import { useState } from 'react';
import {
  useComments,
  useCreateComment,
  useCreateReply,
  useDeleteComment,
} from '@/hooks/useComments';
import { CommentItem } from './CommentItem';
import { CommentComposer } from './CommentComposer';

interface CommentThreadProps {
  projectId: string;
  taskId: string;
  currentUserId: string;
  canManage: boolean;
}

export function CommentThread({
  projectId,
  taskId,
  currentUserId,
  canManage,
}: CommentThreadProps) {
  const { data: comments = [] } = useComments(projectId, taskId);
  const createComment = useCreateComment(projectId, taskId);
  const createReply = useCreateReply(projectId, taskId);
  const deleteComment = useDeleteComment(projectId, taskId);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Top-level comments only (no parentId)
  const topLevelComments = comments.filter((c) => c.parentId === null);

  const handleReply = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId);
  };

  const handlePostComment = (content: string) => {
    createComment.mutate(content);
  };

  const handlePostReply = (commentId: string, content: string) => {
    createReply.mutate(
      { commentId, content },
      { onSuccess: () => setReplyingTo(null) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold text-muted-foreground">Comments</h2>

      {topLevelComments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {topLevelComments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-2">
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                canManage={canManage}
                onReply={handleReply}
                onDelete={handleDelete}
              />

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="pl-8 flex flex-col gap-2">
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      canManage={canManage}
                      onReply={handleReply}
                      onDelete={handleDelete}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Inline reply composer */}
              {replyingTo === comment.id && (
                <div className="pl-8">
                  <CommentComposer
                    onSubmit={(content) => handlePostReply(comment.id, content)}
                    isPending={createReply.isPending}
                    placeholder="Write a reply..."
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New top-level comment composer */}
      <CommentComposer
        onSubmit={handlePostComment}
        isPending={createComment.isPending}
        placeholder="Add a comment..."
      />
    </div>
  );
}
