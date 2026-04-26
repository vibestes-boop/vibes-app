'use client';

import { useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { CommentThread } from './comment-thread';
import { fetchMoreComments } from '@/app/actions/engagement';
import type { CommentWithAuthor } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// LoadMoreComments — v1.w.UI.60
//
// Client-Component das an das Ende der SSR-gerenderten Kommentarliste gehängt
// wird. Lädt weitere Top-Level-Kommentare per Server Action in 20er-Batches
// (Offset-basiert, konsistent mit dem SSR-initialen Batch).
//
// Props:
//   postId        — für fetchMoreComments
//   initialOffset — Anzahl bereits geladener Kommentare (= SSR-Batch-Größe)
//   totalCount    — gesamt laut post.comment_count
//   viewerId      — für liked_by_me korrekt rendern
//   isAuthenticated / postPath — für CommentThread (Reply-Form, Auth-Gate)
// -----------------------------------------------------------------------------

const PAGE_SIZE = 20;

export function LoadMoreComments({
  postId,
  initialOffset,
  totalCount,
  viewerId,
  isAuthenticated,
  postPath,
}: {
  postId: string;
  initialOffset: number;
  totalCount: number;
  viewerId: string | null;
  isAuthenticated: boolean;
  postPath: string;
}) {
  const [extra, setExtra] = useState<CommentWithAuthor[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [loading, setLoading] = useState(false);

  const loaded = initialOffset + extra.length;
  const remaining = totalCount - loaded;
  const hasMore = remaining > 0;

  const handleLoadMore = async () => {
    setLoading(true);
    try {
      const next = await fetchMoreComments(postId, offset, PAGE_SIZE);
      if (next.length > 0) {
        setExtra((prev) => [...prev, ...next]);
        setOffset((o) => o + next.length);
      }
    } catch {
      toast.error('Kommentare konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bereits nachgeladene Kommentare */}
      {extra.length > 0 && (
        <ul className="space-y-5">
          {extra.map((c) => (
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

      {/* "Mehr laden"-Button — nur sichtbar wenn noch Kommentare übrig */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {loading
              ? 'Lädt…'
              : `${remaining.toLocaleString('de-DE')} weitere Kommentar${remaining === 1 ? '' : 'e'} laden`}
          </button>
        </div>
      )}
    </>
  );
}
