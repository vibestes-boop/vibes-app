'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import type { CommentWithAuthor } from '@/lib/data/public';
import { CommentThread } from './comment-thread';
import { LoadMoreComments } from './load-more-comments';
import { CommentForm } from './comment-form';

type LocalComment = CommentWithAuthor & {
  localStatus: 'pending' | 'confirmed';
  baseTotalCount: number;
};

// -----------------------------------------------------------------------------
// PostComments — Server-Component Wrapper für die Kommentar-Sektion auf
// /p/[postId].
//
// v1.w.UI.47: Jeder Top-Level-Kommentar wird als <CommentThread> gerendert —
// einem Client-Component das Replies lazy lädt und eine Inline-Reply-Form hat.
// -----------------------------------------------------------------------------

export function PostComments({
  comments,
  allowComments,
  totalCount,
  isAuthenticated,
  postId,
  postPath,
  viewerId,
  viewerAuthor,
}: {
  comments: CommentWithAuthor[];
  allowComments: boolean;
  totalCount: number;
  isAuthenticated: boolean;
  postId: string;
  postPath: string;
  viewerId: string | null;
  viewerAuthor?: CommentWithAuthor['author'] | null;
}) {
  const [localComments, setLocalComments] = useState<LocalComment[]>([]);

  useEffect(() => {
    setLocalComments((prev) => prev.filter((local) => !comments.some((c) => c.id === local.id)));
  }, [comments]);

  if (!allowComments) {
    return (
      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          Kommentare für dieses Video sind deaktiviert.
        </div>
      </section>
    );
  }

  const visibleLocalComments = localComments.filter(
    (local) => !comments.some((c) => c.id === local.id),
  );
  const visibleComments = [...comments, ...visibleLocalComments];
  const visibleCount =
    totalCount +
    visibleLocalComments.filter(
      (local) => local.localStatus === 'pending' || totalCount <= local.baseTotalCount,
    ).length;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">
        {visibleCount.toLocaleString('de-DE')} {visibleCount === 1 ? 'Kommentar' : 'Kommentare'}
      </h2>

      {visibleComments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Noch keine Kommentare. Sei der Erste!
        </p>
      ) : (
        <ul className="space-y-5">
          {visibleComments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              postId={postId}
              isAuthenticated={isAuthenticated}
              postPath={postPath}
              viewerId={viewerId}
            />
          ))}
        </ul>
      )}

      {/* v1.w.UI.60: "Mehr laden" statt totem Hinweis-Text */}
      {comments.length < totalCount && (
        <LoadMoreComments
          postId={postId}
          initialOffset={comments.length}
          totalCount={totalCount}
          viewerId={viewerId}
          isAuthenticated={isAuthenticated}
          postPath={postPath}
        />
      )}

      <CommentForm
        postId={postId}
        isAuthenticated={isAuthenticated}
        postPath={postPath}
        viewerAuthor={viewerAuthor}
        onOptimisticComment={(comment) => {
          setLocalComments((prev) =>
            prev.some((c) => c.id === comment.id)
              ? prev
              : [...prev, { ...comment, localStatus: 'pending', baseTotalCount: totalCount }],
          );
        }}
        onCommentConfirmed={(temporaryId, comment) => {
          setLocalComments((prev) => {
            const optimistic = prev.find((c) => c.id === temporaryId);
            return [
              ...prev.filter((c) => c.id !== temporaryId && c.id !== comment.id),
              {
                ...comment,
                localStatus: 'confirmed',
                baseTotalCount: optimistic?.baseTotalCount ?? totalCount,
              },
            ];
          });
        }}
        onCommentFailed={(temporaryId) => {
          setLocalComments((prev) => prev.filter((c) => c.id !== temporaryId));
        }}
      />
    </section>
  );
}
