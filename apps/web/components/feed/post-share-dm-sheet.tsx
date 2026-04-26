'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import Image from 'next/image';
import { createBrowserClient } from '@supabase/ssr';
import { Search, X, BadgeCheck, Loader2, Check, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getOrCreateConversation, sendDirectMessage } from '@/app/actions/messages';

// -----------------------------------------------------------------------------
// PostShareDmSheet — Modal für „Post via DM teilen" (v1.w.UI.74).
//
// Öffnet wenn der Share-Button im FeedCard-Rail geklickt wird (authentifiziert).
// Zeigt:
//   1. Post-Preview (Thumbnail + Autor + Caption-Snippet) oben.
//   2. User-Suche (Supabase profiles ILIKE, 200ms Debounce).
//   3. Pro Treffer ein Send-Button — nach erfolgreichem Senden Inline-✓.
//   4. „Link kopieren"-Footer als Secondary-Aktion.
//
// Nach dem Senden bleibt das Sheet offen damit der User weitere Empfänger
// wählen kann (TikTok-Parity: Multi-Send). Schließen via X oder Backdrop.
//
// Props:
//   `post` — Minimalsubset aus FeedPost. Kein FeedPost-Import um Circular-
//             Dependency (feed-card → post-share-dm-sheet → feed-card) zu
//             vermeiden.
// -----------------------------------------------------------------------------

export interface ShareablePost {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Maximal-Länge der Caption-Preview (ellipsiert)
const CAPTION_PREVIEW_MAX = 72;

export function PostShareDmSheet({
  post,
  onClose,
}: {
  post: ShareablePost;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // sentTo: Map<userId → 'sending' | 'sent' | 'error'>
  const [sentTo, setSentTo] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [, startTransition] = useTransition();
  const searchTokenRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofokus nach Mount (Dialog-Accessibility-Pattern)
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  // User-Suche: 200ms Debounce + Race-Condition-Guard via Token
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const token = ++searchTokenRef.current;
    setSearching(true);
    const tid = setTimeout(async () => {
      const { data } = await supa()
        .from('profiles')
        .select('id, username, display_name, avatar_url, verified:is_verified')
        .ilike('username', `%${trimmed}%`)
        .limit(20);
      if (token !== searchTokenRef.current) return;
      setResults((data as SearchResult[]) ?? []);
      setSearching(false);
    }, 200);
    return () => clearTimeout(tid);
  }, [query]);

  // ESC-Key → Close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSend = useCallback(
    (userId: string) => {
      if (sentTo[userId] === 'sending' || sentTo[userId] === 'sent') return;
      setSentTo((prev) => ({ ...prev, [userId]: 'sending' }));
      startTransition(async () => {
        const convRes = await getOrCreateConversation(userId);
        if (!convRes.ok) {
          setSentTo((prev) => ({ ...prev, [userId]: 'error' }));
          toast.error('Senden fehlgeschlagen.', { description: convRes.error });
          return;
        }
        const msgRes = await sendDirectMessage({
          conversationId: convRes.data.id,
          postId: post.id,
        });
        if (!msgRes.ok) {
          setSentTo((prev) => ({ ...prev, [userId]: 'error' }));
          toast.error('Senden fehlgeschlagen.', { description: msgRes.error });
          return;
        }
        setSentTo((prev) => ({ ...prev, [userId]: 'sent' }));
      });
    },
    [post.id, sentTo],
  );

  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link kopiert.');
    } catch {
      toast.error('Kopieren fehlgeschlagen.');
    }
  }, [post.id]);

  const captionPreview =
    post.caption && post.caption.length > CAPTION_PREVIEW_MAX
      ? `${post.caption.slice(0, CAPTION_PREVIEW_MAX)}…`
      : post.caption;

  return (
    // Backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post teilen"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
    >
      {/* Panel — stoppt Click-Bubbling zum Backdrop */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Teilen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ── Post-Preview ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
          {/* Thumbnail */}
          <div className="relative h-14 w-10 flex-none overflow-hidden rounded-lg bg-muted">
            {post.thumbnail_url && (
              <Image
                src={post.thumbnail_url}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            )}
          </div>
          {/* Meta */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              @{post.author.username}
            </p>
            {captionPreview && (
              <p className="truncate text-xs text-muted-foreground">{captionPreview}</p>
            )}
          </div>
        </div>

        {/* ── Suchfeld ────────────────────────────────────────────── */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
            <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="@username suchen"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Empfänger suchen"
            />
            {searching && (
              <Loader2 className="h-4 w-4 flex-none animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* ── Ergebnisliste ───────────────────────────────────────── */}
        <div className="max-h-[40vh] min-h-[80px] overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Tippe mindestens 2 Zeichen.
            </p>
          ) : !searching && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Keine Treffer.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r) => {
                const state = sentTo[r.id];
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    {/* Avatar */}
                    <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-muted">
                      {r.avatar_url && (
                        <Image
                          src={r.avatar_url}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    {/* Name */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium">
                          {r.display_name ?? `@${r.username}`}
                        </span>
                        {r.verified && (
                          <BadgeCheck className="h-3.5 w-3.5 flex-none text-sky-500" aria-hidden="true" />
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">@{r.username}</span>
                    </div>
                    {/* Send-Button / Status */}
                    <button
                      type="button"
                      onClick={() => handleSend(r.id)}
                      disabled={state === 'sending' || state === 'sent'}
                      aria-label={
                        state === 'sent'
                          ? `An @${r.username} gesendet`
                          : `An @${r.username} senden`
                      }
                      className={[
                        'flex-none rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                        state === 'sent'
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : state === 'error'
                          ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                          : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60',
                      ].join(' ')}
                    >
                      {state === 'sending' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : state === 'sent' ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Gesendet
                        </span>
                      ) : state === 'error' ? (
                        'Retry'
                      ) : (
                        'Senden'
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Footer: Link kopieren ───────────────────────────────── */}
        <div className="border-t px-4 py-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
              <LinkIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <span className="font-medium">Link kopieren</span>
          </button>
        </div>
      </div>
    </div>
  );
}
