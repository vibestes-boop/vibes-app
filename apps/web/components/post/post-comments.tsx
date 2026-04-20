import Link from 'next/link';
import { Heart, BadgeCheck, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { CommentWithAuthor } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// PostComments — reiner Server-Read. Web-Phase 2 bietet keine Kommentar-
// Eingabe — schreibende Aktionen laufen in der App. Das "Zum Mitreden die App
// öffnen"-CTA ist deshalb am Ende (statt ein deaktiviertes Eingabefeld zu
// zeigen, das User verwirrt).
// -----------------------------------------------------------------------------

// "vor 3 Min", "vor 2 Std", "gestern", "15. März" — deutsch, kompakt.
function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const delta = Math.max(0, (now - t) / 1000);

  if (delta < 60) return 'gerade eben';
  if (delta < 3600) return `vor ${Math.floor(delta / 60)} Min`;
  if (delta < 86400) return `vor ${Math.floor(delta / 3600)} Std`;
  if (delta < 172800) return 'gestern';
  if (delta < 604800) return `vor ${Math.floor(delta / 86400)} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

export function PostComments({
  comments,
  allowComments,
  totalCount,
}: {
  comments: CommentWithAuthor[];
  allowComments: boolean;
  totalCount: number;
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
          Sei die erste Person, die hier kommentiert — in der Serlo-App.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const authorName = c.author.display_name ?? `@${c.author.username}`;
            return (
              <li key={c.id} className="flex gap-3">
                <Link
                  href={`/u/${c.author.username}`}
                  className="shrink-0"
                  aria-label={`Profil von @${c.author.username}`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={c.author.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">
                      {(c.author.display_name ?? c.author.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                    <Link
                      href={`/u/${c.author.username}`}
                      className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
                    >
                      {authorName}
                      {c.author.verified && (
                        <BadgeCheck
                          className="h-3.5 w-3.5 fill-brand-gold text-background"
                          aria-label="Verifiziert"
                        />
                      )}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatRelative(c.created_at)}
                    </span>
                  </div>

                  <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed">
                    {c.body}
                  </p>

                  {c.like_count > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="h-3 w-3" />
                      {c.like_count.toLocaleString('de-DE')}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {comments.length < totalCount && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Zeige die neuesten {comments.length} von {totalCount.toLocaleString('de-DE')} Kommentaren —
          öffne die App für die volle Liste.
        </p>
      )}
    </section>
  );
}
