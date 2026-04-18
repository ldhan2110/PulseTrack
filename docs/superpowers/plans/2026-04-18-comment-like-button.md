# Comment Like Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thumbs-up like toggle to comments on Task Detail and Bug Detail pages, with hover tooltip showing who liked.

**Architecture:** New `CommentLike` join table with unique constraint. Single `toggleLike` method in `CommentsService`. `CommentItem.tsx` (shared component) gets a like button with 3 visual states and Radix Tooltip. Frontend hooks invalidate comment queries on toggle.

**Tech Stack:** Prisma, NestJS, React, TanStack Query, Radix Tooltip, Tailwind CSS, lucide-react (ThumbsUp icon)

**Spec:** `docs/superpowers/specs/2026-04-18-comment-like-button-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/api/prisma/schema.prisma` | Add `CommentLike` model, relations on `Comment` and `User` |
| Modify | `apps/api/src/comments/comments.service.ts` | Add `toggleLike`, include likes in `findAll`/`findAllForBug` queries |
| Modify | `apps/api/src/comments/comments.controller.ts` | Add `POST :commentId/likes` endpoint |
| Modify | `apps/api/src/comments/bug-comments.controller.ts` | Add `POST :commentId/likes` endpoint |
| Modify | `apps/web/src/lib/types.ts` | Add `CommentLike` interface, extend `Comment` |
| Modify | `apps/web/src/lib/api.ts` | Add `toggleCommentLike` and `toggleBugCommentLike` functions |
| Modify | `apps/web/src/hooks/useComments.ts` | Add `useToggleCommentLike` hook |
| Modify | `apps/web/src/hooks/useBugComments.ts` | Add `useToggleBugCommentLike` hook |
| Modify | `apps/web/src/components/tasks/CommentItem.tsx` | Add like button with 3 states + Radix Tooltip |
| Modify | `apps/web/src/components/tasks/CommentThread.tsx` | Wire `onToggleLike` to `CommentItem` |
| Modify | `apps/web/src/components/bugs/BugCommentThread.tsx` | Wire `onToggleLike` to `CommentItem` |

---

### Task 1: Add CommentLike Prisma Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma:341-357` (Comment model) and `:185-219` (User model)

- [ ] **Step 1: Add CommentLike model to schema.prisma**

Add the new model after the `Comment` model (after line 357):

```prisma
model CommentLike {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  createdAt DateTime @default(now())

  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user      User     @relation("CommentLikeUser", fields: [userId], references: [id])

  @@unique([commentId, userId])
}
```

- [ ] **Step 2: Add reverse relation to Comment model**

In the `Comment` model (line ~356, before the closing `}`), add:

```prisma
  likes     CommentLike[]
```

- [ ] **Step 3: Add reverse relation to User model**

In the `User` model (line ~218, before the closing `}`), add:

```prisma
  commentLikes            CommentLike[]     @relation("CommentLikeUser")
```

- [ ] **Step 4: Run Prisma db push**

Run: `cd apps/api && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add CommentLike model with unique constraint"
```

---

### Task 2: Backend — toggleLike + Include Likes in Queries

**Files:**
- Modify: `apps/api/src/comments/comments.service.ts`

- [ ] **Step 1: Add likes include to AUTHOR_SELECT area and findAll**

In `comments.service.ts`, add a static `LIKE_SELECT` constant after `AUTHOR_SELECT` (line ~16):

```typescript
private static readonly LIKE_SELECT = {
  userId: true,
  user: { select: { id: true, username: true, name: true, imageUrl: true } },
} as const;
```

- [ ] **Step 2: Update findAll to include likes**

In the `findAll` method (line ~36), update the `include` to add likes:

```typescript
async findAll(taskId: string) {
  const comments = await this.prisma.comment.findMany({
    where: { taskId },
    include: {
      author: { select: CommentsService.AUTHOR_SELECT },
      likes: { select: CommentsService.LIKE_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  });
  return this.buildCommentTree(comments);
}
```

- [ ] **Step 3: Update findAllForBug to include likes**

In the `findAllForBug` method (line ~145), update the `include` to add likes:

```typescript
async findAllForBug(bugId: string) {
  const comments = await this.prisma.comment.findMany({
    where: { bugId },
    include: {
      author: { select: CommentsService.AUTHOR_SELECT },
      likes: { select: CommentsService.LIKE_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  });
  return this.buildCommentTree(comments);
}
```

- [ ] **Step 4: Add toggleLike method**

Add the `toggleLike` method at the end of the class (before the closing `}`):

```typescript
async toggleLike(commentId: string, userId: string) {
  const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    throw new NotFoundException('Comment not found');
  }

  const existing = await this.prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing) {
    await this.prisma.commentLike.delete({ where: { id: existing.id } });
  } else {
    await this.prisma.commentLike.create({ data: { commentId, userId } });
  }

  const likes = await this.prisma.commentLike.findMany({
    where: { commentId },
    select: CommentsService.LIKE_SELECT,
  });

  return {
    likes,
    liked: !existing,
    count: likes.length,
  };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/comments/comments.service.ts
git commit -m "feat(comments): add toggleLike method and include likes in queries"
```

---

### Task 3: Backend — Controller Endpoints

**Files:**
- Modify: `apps/api/src/comments/comments.controller.ts`
- Modify: `apps/api/src/comments/bug-comments.controller.ts`

- [ ] **Step 1: Add toggleLike endpoint to CommentsController**

In `comments.controller.ts`, add after the `remove` method (line ~54):

```typescript
@Post(':commentId/likes')
toggleLike(
  @Param('commentId') commentId: string,
  @Req() req: any,
) {
  return this.commentsService.toggleLike(commentId, req.user.id);
}
```

- [ ] **Step 2: Add toggleLike endpoint to BugCommentsController**

In `bug-comments.controller.ts`, add after the `remove` method (line ~54):

```typescript
@Post(':commentId/likes')
toggleLike(
  @Param('commentId') commentId: string,
  @Req() req: any,
) {
  return this.commentsService.toggleLike(commentId, req.user.id);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/comments/comments.controller.ts apps/api/src/comments/bug-comments.controller.ts
git commit -m "feat(comments): add toggle like endpoints for task and bug comments"
```

---

### Task 4: Frontend Types and API Functions

**Files:**
- Modify: `apps/web/src/lib/types.ts:435-447`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add CommentLike interface to types.ts**

In `apps/web/src/lib/types.ts`, add before the `Comment` interface (before line 435):

```typescript
export interface CommentLike {
  userId: string;
  user: Pick<User, 'id' | 'name' | 'username' | 'imageUrl'>;
}
```

- [ ] **Step 2: Add likes field to Comment interface**

In the `Comment` interface, add after the `replies` field (line ~446):

```typescript
  likes?: CommentLike[];
```

- [ ] **Step 3: Add ToggleLikeResponse interface**

Add after `CreateCommentPayload` (after line ~451):

```typescript
export interface ToggleLikeResponse {
  likes: CommentLike[];
  liked: boolean;
  count: number;
}
```

- [ ] **Step 4: Add toggleCommentLike API function**

In `apps/web/src/lib/api.ts`, add after the `updateComment` function (after line ~490):

```typescript
toggleCommentLike: (projectId: string, taskId: string, commentId: string) =>
  request<ToggleLikeResponse>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}/likes`, {
    method: 'POST',
  }),
```

- [ ] **Step 5: Add toggleBugCommentLike API function**

In `apps/web/src/lib/api.ts`, add after the `updateBugComment` function (after line ~589):

```typescript
toggleBugCommentLike: (projectId: string, bugId: string, commentId: string) =>
  request<ToggleLikeResponse>(`/projects/${projectId}/bugs/${bugId}/comments/${commentId}/likes`, {
    method: 'POST',
  }),
```

- [ ] **Step 6: Add ToggleLikeResponse to imports in api.ts**

Update the import from `'./types'` at the top of `api.ts` to include `ToggleLikeResponse`.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(web): add CommentLike types and toggle API functions"
```

---

### Task 5: Frontend Hooks — useToggleCommentLike

**Files:**
- Modify: `apps/web/src/hooks/useComments.ts`
- Modify: `apps/web/src/hooks/useBugComments.ts`

- [ ] **Step 1: Add useToggleCommentLike hook**

In `apps/web/src/hooks/useComments.ts`, add after the `useUpdateComment` function (after line ~69):

```typescript
export function useToggleCommentLike(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.toggleCommentLike(projectId, taskId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
```

- [ ] **Step 2: Add useToggleBugCommentLike hook**

In `apps/web/src/hooks/useBugComments.ts`, add after the `useUpdateBugComment` function (after line ~72):

```typescript
export function useToggleBugCommentLike(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.toggleBugCommentLike(projectId, bugId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useComments.ts apps/web/src/hooks/useBugComments.ts
git commit -m "feat(web): add useToggleCommentLike and useToggleBugCommentLike hooks"
```

---

### Task 6: CommentItem — Like Button UI

**Files:**
- Modify: `apps/web/src/components/tasks/CommentItem.tsx`

- [ ] **Step 1: Add imports**

At the top of `CommentItem.tsx`, add to the lucide-react import (line 5):

```typescript
import { Trash2, Reply, Pencil, ThumbsUp } from 'lucide-react';
```

Add the Tooltip imports:

```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
```

- [ ] **Step 2: Add onToggleLike to CommentItemProps**

In the `CommentItemProps` interface (line ~31), add:

```typescript
onToggleLike: (commentId: string) => void;
```

- [ ] **Step 3: Destructure onToggleLike in component**

In the function signature (line ~45), add `onToggleLike` to the destructured props:

```typescript
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
  onToggleLike,
}: CommentItemProps) {
```

- [ ] **Step 4: Add like state computation**

After the `relativeTime` declaration (after line ~69), add:

```typescript
const likes = comment.likes ?? [];
const likeCount = likes.length;
const isLikedByMe = likes.some((l) => l.userId === currentUserId);
const hasLikes = likeCount > 0;

const likeTooltipText = (() => {
  if (likeCount === 0) return '';
  const names = likes.map((l) =>
    l.userId === currentUserId ? 'You' : (l.user.name ?? l.user.username)
  );
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')}, and ${names.length - 3} other${names.length - 3 > 1 ? 's' : ''}`;
})();
```

- [ ] **Step 5: Add like button to the action bar**

In the actions `div` (line ~133), replace the entire div with:

```tsx
<div className="flex items-center gap-1 mt-1">
  {/* Like button — always visible when has likes, hover-only when no likes */}
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-xs gap-1 ${
            isLikedByMe
              ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 opacity-100'
              : hasLikes
                ? 'bg-muted text-muted-foreground hover:bg-muted/80 opacity-100'
                : 'opacity-0 group-hover/comment:opacity-100'
          } transition-opacity`}
          onClick={() => onToggleLike(comment.id)}
        >
          <ThumbsUp className={`size-3 ${isLikedByMe ? 'fill-current' : ''}`} />
          {hasLikes && likeCount}
        </Button>
      </TooltipTrigger>
      {hasLikes && (
        <TooltipContent side="top">
          {likeTooltipText}
        </TooltipContent>
      )}
    </Tooltip>
  </TooltipProvider>

  {/* Existing actions — hover only */}
  <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
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
```

This replaces the existing actions div at line 133-181. The key change: the outer div no longer has the `opacity-0 group-hover/comment:opacity-100` classes — those now only apply to the inner div wrapping Reply/Edit/Delete. The like button has its own visibility logic.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Errors about missing `onToggleLike` prop in `CommentThread.tsx` and `BugCommentThread.tsx` (expected — fixed in Task 7).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tasks/CommentItem.tsx
git commit -m "feat(web): add like button with tooltip to CommentItem"
```

---

### Task 7: Wire Like to CommentThread and BugCommentThread

**Files:**
- Modify: `apps/web/src/components/tasks/CommentThread.tsx`
- Modify: `apps/web/src/components/bugs/BugCommentThread.tsx`

- [ ] **Step 1: Update CommentThread.tsx — add hook import**

In `CommentThread.tsx`, update the import from `@/hooks/useComments` (line ~2-7) to include `useToggleCommentLike`:

```typescript
import {
  useComments,
  useCreateComment,
  useCreateReply,
  useDeleteComment,
  useUpdateComment,
  useToggleCommentLike,
} from '@/hooks/useComments';
```

- [ ] **Step 2: Add hook call in CommentThread**

In the `CommentThread` component (after line ~127, after `const updateComment = ...`), add:

```typescript
const toggleLike = useToggleCommentLike(projectId, taskId);
```

- [ ] **Step 3: Add handleToggleLike handler**

After `handleEdit` (after line ~147), add:

```typescript
const handleToggleLike = (commentId: string) => {
  toggleLike.mutate(commentId);
};
```

- [ ] **Step 4: Pass onToggleLike to RecursiveComment**

In the `RecursiveComment` type signature (line ~23), add `onToggleLike` prop:

```typescript
onToggleLike: (commentId: string) => void;
```

In the `RecursiveComment` destructured params, add `onToggleLike`.

In `RecursiveComment`'s JSX, pass to `CommentItem` (line ~64-73):

```tsx
<CommentItem
  comment={comment}
  currentUserId={currentUserId}
  canManage={canManage}
  projectId={projectId}
  taskId={taskId}
  onReply={onReply}
  onDelete={onDelete}
  onEdit={onEdit}
  onToggleLike={onToggleLike}
/>
```

Also pass `onToggleLike` to the recursive `<RecursiveComment>` calls (line ~92-108).

In the parent `CommentThread` usage (line ~190-205), pass `onToggleLike={handleToggleLike}` to `RecursiveComment`.

- [ ] **Step 5: Update BugCommentThread.tsx — same pattern**

In `BugCommentThread.tsx`, make the same changes:

Import `useToggleBugCommentLike` from `@/hooks/useBugComments`:

```typescript
import {
  useBugComments,
  useCreateBugComment,
  useCreateBugReply,
  useDeleteBugComment,
  useUpdateBugComment,
  useToggleBugCommentLike,
} from '@/hooks/useBugComments';
```

Add hook call after `updateComment`:

```typescript
const toggleLike = useToggleBugCommentLike(projectId, bugId);
```

Add handler:

```typescript
const handleToggleLike = (commentId: string) => {
  toggleLike.mutate(commentId);
};
```

Add `onToggleLike` prop to `RecursiveBugComment` type signature.

Pass `onToggleLike` to `CommentItem` and to recursive `<RecursiveBugComment>` calls.

Pass `onToggleLike={handleToggleLike}` from `BugCommentThread` to `RecursiveBugComment`.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tasks/CommentThread.tsx apps/web/src/components/bugs/BugCommentThread.tsx
git commit -m "feat(web): wire like toggle to CommentThread and BugCommentThread"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Start the API server**

Run: `cd apps/api && npm run start:dev`
Verify it starts without errors.

- [ ] **Step 2: Start the web app**

Run: `cd apps/web && npm run dev`
Verify it starts without errors.

- [ ] **Step 3: Verify full TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit && cd ../api && npx tsc --noEmit`
Expected: No errors in either project.

- [ ] **Step 4: Manual test checklist**

1. Navigate to a task detail page with comments
2. Hover a comment — like button (outline thumb) appears with Reply/Edit/Delete
3. Click like — button turns blue with filled thumb, shows "1"
4. Hover the liked button — tooltip shows "You"
5. Click again — unlike, button returns to outline state
6. Have another user like the same comment — verify count shows "2" and tooltip shows both names
7. Navigate to a bug detail page — verify same behavior on bug comments
8. Verify threaded/nested comments also have working like buttons
