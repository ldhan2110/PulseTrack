# Comment Like Button — Design Spec

## Overview

Add a thumbs-up "like" button to comments on both Task Detail and Bug Detail pages. Users can toggle a like to acknowledge a comment. The like count and likers are visible on hover.

## Requirements

- Simple thumbs-up toggle (not emoji reactions)
- One like per user per comment
- Hover tooltip shows who liked (up to 3 names + "and N others")
- No activity log entry — silent like
- Works on both task comments and bug comments (shared `CommentItem` component)

## Data Model

### New Prisma Model: `CommentLike`

```prisma
model CommentLike {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  createdAt DateTime @default(now())

  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])

  @@unique([commentId, userId])
}
```

- `onDelete: Cascade` on comment — when a comment is deleted, its likes are cleaned up automatically.
- `@@unique([commentId, userId])` — enforces one like per user per comment at the database level.

### Comment Model Update

Add reverse relation to `Comment`:

```prisma
model Comment {
  // ... existing fields ...
  likes     CommentLike[]
}
```

### User Model Update

Add reverse relation to `User`:

```prisma
model User {
  // ... existing fields ...
  commentLikes CommentLike[]
}
```

## API Design

### Toggle Like

Single endpoint that creates or removes a like based on current state.

**Task comments:**
```
POST /projects/:projectId/tasks/:taskId/comments/:commentId/likes
```

**Bug comments:**
```
POST /projects/:projectId/bugs/:bugId/comments/:commentId/likes
```

**Auth:** `JwtAuthGuard` + `ProjectRolesGuard` (same as existing comment endpoints).

**Request body:** None.

**Response:** Updated likes array for the comment:
```json
{
  "likes": [
    { "userId": "abc", "user": { "id": "abc", "name": "Alice", "username": "alice", "imageUrl": null } }
  ],
  "liked": true,
  "count": 3
}
```

**Behavior:**
- If user has not liked → create `CommentLike` → return `liked: true`
- If user has already liked → delete `CommentLike` → return `liked: false`
- No history/activity log entry created

## Backend Implementation

### CommentsService

Add `toggleLike(commentId: string, userId: string)` method:

1. Check if `CommentLike` exists for `(commentId, userId)`
2. If exists → delete it (unlike)
3. If not → create it (like)
4. Return updated likes array with user details, `liked` boolean, and `count`

### Comment Queries Update

Extend `findAll` and `findAllForBug` to include likes:

```typescript
include: {
  author: { select: AUTHOR_SELECT },
  likes: {
    select: {
      userId: true,
      user: { select: AUTHOR_SELECT },
    },
  },
}
```

### Controller Endpoints

Add `toggleLike` endpoint to both `CommentsController` and `BugCommentsController`:

```typescript
@Post(':commentId/likes')
toggleLike(
  @Param('commentId') commentId: string,
  @Req() req: any,
) {
  return this.commentsService.toggleLike(commentId, req.user.id);
}
```

## Frontend

### Type Update (`lib/types.ts`)

```typescript
export interface CommentLike {
  userId: string;
  user: Pick<User, 'id' | 'name' | 'username' | 'imageUrl'>;
}

export interface Comment {
  // ... existing fields ...
  likes?: CommentLike[];
}
```

### API Function (`lib/api.ts`)

Add `toggleCommentLike` function for both task and bug contexts.

### React Query Hooks

Add `useToggleCommentLike` and `useToggleBugCommentLike` hooks in their respective hook files:
- Mutation calls toggle endpoint
- `onSuccess` invalidates the comments query key
- Optimistic update for instant UI feedback

### CommentItem.tsx Changes

Add like button to the action bar (line 133-181), positioned before the Reply button:

**Three visual states:**

1. **No likes (count = 0):** Outline `ThumbsUp` icon from lucide-react. Visible only on comment hover (same `opacity-0 group-hover/comment:opacity-100` pattern as other actions).

2. **Others liked, not you:** Outline `ThumbsUp` icon + count badge. Subtle muted background (`bg-muted`). Always visible (not gated by hover).

3. **You liked:** Filled `ThumbsUp` icon + count. Blue tint background (`bg-blue-500/15 text-blue-400`). Always visible.

**Click handler:** Calls `onToggleLike(comment.id)`.

**Hover tooltip:** Uses existing tooltip pattern or a simple `title` attribute / custom Tooltip component:
- Shows up to 3 names: "Alice Chen, Bob Smith, You"
- If more than 3: "Alice Chen, Bob Smith, You, and 2 others"
- Use Radix `Tooltip` component if available, otherwise a custom hover div

### Props Update

Add to `CommentItemProps`:
```typescript
onToggleLike: (commentId: string) => void;
currentUserId: string;  // already exists — used to determine "You liked"
```

### Parent Components

**CommentThread.tsx** and **BugCommentThread.tsx:**
- Wire up the `useToggleCommentLike` / `useToggleBugCommentLike` hook
- Pass `onToggleLike` callback to `CommentItem`

## UI Behavior Details

- **Optimistic update:** On click, immediately toggle the visual state and count. Revert on error.
- **Debounce:** No debounce needed — the unique constraint prevents duplicates, and rapid toggles are rare.
- **Tooltip truncation:** Show max 3 names. If current user liked, "You" appears in the list. "and N others" for remainder.
- **Like your own comment:** Allowed (standard behavior in most tools).

## Scope

### In scope
- `CommentLike` Prisma model + migration
- Toggle like API endpoint (task + bug)
- Include likes in comment queries
- Like button UI in `CommentItem.tsx`
- Hover tooltip with liker names
- React Query hooks with optimistic updates

### Out of scope
- Emoji reactions (future consideration)
- Activity log entries for likes
- Notification on like
- Like count analytics
