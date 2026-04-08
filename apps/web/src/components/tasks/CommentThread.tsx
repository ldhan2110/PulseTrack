import { useState } from 'react';
import {
  useComments,
  useCreateComment,
  useCreateReply,
  useDeleteComment,
  useUpdateComment,
} from '@/hooks/useComments';
import { useMembers } from '@/hooks/useMembers';
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
  const { data: members = [] } = useMembers(projectId);
  const createComment = useCreateComment(projectId, taskId);
  const createReply = useCreateReply(projectId, taskId);
  const deleteComment = useDeleteComment(projectId, taskId);
  const updateComment = useUpdateComment(projectId, taskId);

  const mentionMembers = members.map((m) => ({
    id: m.userId,
    label: m.user.name ?? m.user.username,
  }));

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Top-level comments only (no parentId)
  const topLevelComments = comments.filter((c) => c.parentId === null);

  const handleReply = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId);
  };

  const handleEdit = (commentId: string, content: string) => {
    updateComment.mutate({ commentId, content });
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
      {topLevelComments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {topLevelComments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 flex flex-col gap-2">
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                canManage={canManage}
                projectId={projectId}
                taskId={taskId}
                onReply={handleReply}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-5 border-l-2 border-border pl-4 flex flex-col gap-2">
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      canManage={canManage}
                      projectId={projectId}
                      taskId={taskId}
                      onReply={handleReply}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Inline reply composer */}
              {replyingTo === comment.id && (
                <div className="ml-5 border-l-2 border-border pl-4">
                  <CommentComposer
                    onSubmit={(content) => handlePostReply(comment.id, content)}
                    isPending={createReply.isPending}
                    projectId={projectId}
                    taskId={taskId}
                    placeholder="Write a reply..."
                    onCancel={() => setReplyingTo(null)}
                    members={mentionMembers}
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
        projectId={projectId}
        taskId={taskId}
        placeholder="Add a comment..."
        members={mentionMembers}
      />
    </div>
  );
}
