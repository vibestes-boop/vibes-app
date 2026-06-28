import type { LiveCommentWithAuthor } from '@/lib/data/live';

export const LIVE_COMMENT_BROADCAST_EVENT = 'comment-created';

export type LiveCommentBroadcastPayload = {
  comment?: LiveCommentWithAuthor | null;
};

// ─── Cross-Platform-Bridge zur nativen App ──────────────────────────────────
// Die native App hört Live-Kommentare ausschließlich über einen Broadcast-
// Channel mit ANDEREM Namen/Event als die Web (lib/useLiveSession.ts:
// channel `live-comments-${id}`, event `new-comment`) und abonniert KEIN
// postgres_changes für Kommentare. Damit ein Web-Host-Kommentar bei einem
// App-Viewer ankommt, spiegeln wir jeden gesendeten Web-Kommentar zusätzlich
// auf diesem App-Vertrag. Web hört dort selbst NICHT mit → keine Doppelung.
export const APP_LIVE_COMMENT_EVENT = 'new-comment';

export function appLiveCommentChannelName(sessionId: string): string {
  return `live-comments-${sessionId}`;
}

/**
 * Mappt einen Web-Kommentar auf die Broadcast-Form, die die native App erwartet
 * (LiveComment: `text` statt `body`, `profiles{username,avatar_url}` statt `author`).
 */
export function toAppBroadcastComment(comment: LiveCommentWithAuthor) {
  return {
    id: comment.id,
    session_id: comment.session_id,
    user_id: comment.user_id,
    text: comment.body,
    created_at: comment.created_at,
    profiles: comment.author
      ? { username: comment.author.username, avatar_url: comment.author.avatar_url }
      : null,
  };
}

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

