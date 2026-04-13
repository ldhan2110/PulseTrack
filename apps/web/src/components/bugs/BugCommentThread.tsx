import { useState } from 'react';
import {
  useBugComments,
  useCreateBugComment,
  useCreateBugReply,
  useDeleteBugComment,
  useUpdateBugComment,
} from '@/hooks/useBugComments';
import { useMembers } from '@/hooks/useMembers';
import { CommentItem } from '@/components/tasks/CommentItem';
import { CommentComposer } from '@/components/tasks/CommentComposer';
import type { Comment } from '@/lib/types';

const MAX_VISUAL_DEPTH = 4;

interface BugCommentThreadProps {
  projectId: string;
  bugId: string;
  currentUserId: string;
  canManage: boolean;
}

function RecursiveBugComment({
  comment,
  depth,
  currentUserId,
  canManage,
  projectId,
  bugId,
  replyingTo,
  onReply,
  onDelete,
  onEdit,
  onPostReply,
  isReplyPending,
  mentionMembers,
  onCancelReply,
}: {
  comment: Comment;
  depth: number;
  currentUserId: string;
  canManage: boolean;
  projectId: string;
  bugId: string;
  replyingTo: string | null;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onPostReply: (commentId: string, content: string) => void;
  isReplyPending: boolean;
  mentionMembers: { id: string; label: string; imageUrl: string | null }[];
  onCancelReply: () => void;
}) {
  return (
    <div
      className={depth > 0 ? 'ml-5 border-l-2 border-border pl-4' : ''}
      style={depth > MAX_VISUAL_DEPTH ? { marginLeft: 0 } : undefined}
    >
      {depth > MAX_VISUAL_DEPTH && (
        <div className="text-xs text-muted-foreground mb-1 italic">
          replying to @{(comment as any)._parentAuthorName ?? 'someone'}
        </div>
      )}
      <CommentItem
        comment={comment}
        currentUserId={currentUserId}
        canManage={canManage}
        projectId={projectId}
        entityType="bug"
        entityId={bugId}
        onReply={onReply}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {replyingTo === comment.id && (
        <div className="mt-2">
          <CommentComposer
            onSubmit={(content) => onPostReply(comment.id, content)}
            isPending={isReplyPending}
            projectId={projectId}
            entityType="bug"
            entityId={bugId}
            placeholder="Write a reply..."
            onCancel={onCancelReply}
            members={mentionMembers}
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {comment.replies.map((reply) => (
            <RecursiveBugComment
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              currentUserId={currentUserId}
              canManage={canManage}
              projectId={projectId}
              bugId={bugId}
              replyingTo={replyingTo}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              onPostReply={onPostReply}
              isReplyPending={isReplyPending}
              mentionMembers={mentionMembers}
              onCancelReply={onCancelReply}
            />
          ))}
        </div>
      )}
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
  const { data: members = [] } = useMembers(projectId);
  const createComment = useCreateBugComment(projectId, bugId);
  const createReply = useCreateBugReply(projectId, bugId);
  const deleteComment = useDeleteBugComment(projectId, bugId);
  const updateComment = useUpdateBugComment(projectId, bugId);

  const mentionMembers = members.map((m) => ({
    id: m.userId,
    label: m.user.name ?? m.user.username,
    imageUrl: m.user.imageUrl || null,
  }));

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

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

  // Annotate comments with parent author names for deep nesting display
  function annotateParentNames(comments: Comment[], parentMap: Map<string, string>): Comment[] {
    return comments.map((c) => {
      const annotated = { ...c, _parentAuthorName: parentMap.get(c.id) } as any;
      if (c.replies?.length) {
        const childMap = new Map(parentMap);
        for (const reply of c.replies) {
          childMap.set(reply.id, c.author.name ?? c.author.username);
        }
        annotated.replies = annotateParentNames(c.replies, childMap);
      }
      return annotated;
    });
  }

  const parentMap = new Map<string, string>();
  const annotatedComments = annotateParentNames(comments, parentMap);

  return (
    <div className="flex flex-col">
      {/* Scrollable comment list */}
      <div className="flex-1 pr-1">
        {annotatedComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No comments yet. Start the conversation.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {annotatedComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-3 flex flex-col gap-2">
                <RecursiveBugComment
                  comment={comment}
                  depth={0}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  projectId={projectId}
                  bugId={bugId}
                  replyingTo={replyingTo}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onPostReply={handlePostReply}
                  isReplyPending={createReply.isPending}
                  mentionMembers={mentionMembers}
                  onCancelReply={() => setReplyingTo(null)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed comment composer at bottom */}
      <div className="sticky bottom-0 bg-background pt-3 border-t mt-3">
        <CommentComposer
          onSubmit={handlePostComment}
          isPending={createComment.isPending}
          projectId={projectId}
          entityType="bug"
          entityId={bugId}
          placeholder="Add a comment..."
          members={mentionMembers}
        />
      </div>
    </div>
  );
}
