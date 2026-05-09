import type { LiveCommentWithAuthor } from '@/lib/data/live';

export const LIVE_COMMENT_BROADCAST_EVENT = 'comment-created';

export type LiveCommentBroadcastPayload = {
  comment?: LiveCommentWithAuthor | null;
};

export function createOptimisticLiveComment(
  sessionId: string,
  viewerId: string,
  body: string,
): LiveCommentWithAuthor {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    session_id: sessionId,
    user_id: viewerId,
    body,
    created_at: new Date().toISOString(),
    pinned: false,
    author: null,
  };
}

export function mergeLiveComment(
  comments: LiveCommentWithAuthor[],
  incoming: LiveCommentWithAuthor,
): LiveCommentWithAuthor[] {
  const existingIndex = comments.findIndex((comment) => comment.id === incoming.id);

  if (existingIndex >= 0) {
    const next = [...comments];
    const existing = next[existingIndex];
    next[existingIndex] = {
      ...existing,
      ...incoming,
      author: incoming.author ?? existing.author,
      pinned: incoming.pinned ?? existing.pinned,
    };
    return next;
  }

  const next = [...comments, incoming];
  return next.length > 500 ? next.slice(-500) : next;
}

export function replaceOptimisticLiveComment(
  comments: LiveCommentWithAuthor[],
  optimisticId: string,
  persisted: LiveCommentWithAuthor,
): LiveCommentWithAuthor[] {
  return mergeLiveComment(
    comments.filter((comment) => comment.id !== optimisticId),
    persisted,
  );
}

