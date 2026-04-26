import { Lock } from 'lucide-react';
import type { CommentWithAuthor } from '@/lib/data/public';
import { CommentThread } from './comment-thread';

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
}: {
  comments: CommentWithAuthor[];
  allowComments: boolean;
  totalCount: number;
  isAuthenticated: boolean;
  postId: string;
  postPath: string;
}) {
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

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">
        {totalCount.toLocaleString('de-DE')} {totalCount === 1 ? 'Kommentar' : 'Kommentare'}
      </h2>

      {comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Noch keine Kommentare. Sei der Erste!
        </p>
      ) : (
        <ul className="space-y-5">
          {comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              postId={postId}
              isAuthenticated={isAuthenticated}
              postPath={postPath}
            />
          ))}
        </ul>
      )}

      {comments.length < totalCount && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Zeige die neuesten {comments.length} von {totalCount.toLocaleString('de-DE')} Kommentaren.
        </p>
      )}
    </section>
  );
}
