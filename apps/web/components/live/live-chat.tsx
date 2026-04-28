'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, ShieldAlert, Clock, Pin, PinOff } from 'lucide-react';
import { sendLiveComment, timeoutChatUser, pinLiveComment, unpinLiveComment } from '@/app/actions/live';
import type { LiveCommentWithAuthor } from '@/lib/data/live';
import { LiveChatUserPanel } from './live-chat-user-panel';
import type { ChatUserInfo } from './live-chat-user-panel';

// -----------------------------------------------------------------------------
// LiveChat — Realtime-Chat via `live-comments-{id}` Broadcast (gleicher Channel
// wie Native). Initial-State kommt vom SSR (`getLiveComments`), neue Nachrichten
// kommen über Postgres-Changes-Subscription auf `live_comments`-Tabelle.
//
// Moderation: Wenn der Viewer Host ODER CoHost ODER Session-Mod ist, erscheint
// beim Hover auf einen fremden Comment ein Timeout-Menu. Die Server-Action
// `timeoutChatUser` ruft die RPC, die via `is_live_session_moderator` checkt.
// -----------------------------------------------------------------------------

export interface LiveChatProps {
  sessionId: string;
  initialComments: LiveCommentWithAuthor[];
  hostId: string;
  viewerId: string | null;
  isHost: boolean;
  isModerator: boolean;
  slowModeSeconds: number;
  ended: boolean;
  /** v1.w.UI.226 — Local-only system messages injected by the host deck
   * (e.g. "🎉 @username folgt jetzt!"). Not persisted to DB — client-only
   * overlay inside the chat message list. Parity with native sendSystemEvent(). */
  localSystemMessages?: string[];
}

const INPUT_MAX = 200;

export function LiveChat({
  sessionId,
  initialComments,
  hostId,
  viewerId,
  isHost,
  isModerator,
  slowModeSeconds,
  ended,
  localSystemMessages,
}: LiveChatProps) {
  const [comments, setComments] = useState<LiveCommentWithAuthor[]>(initialComments);
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // v1.w.UI.139 — Slow-mode client-side countdown
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------------
  // Realtime-Subscription auf `live_comments`-Inserts. Native broadcasted
  // zusätzlich über den `live-comments-{id}` Channel; wir nutzen hier die
  // einfachere `postgres_changes`-Subscription, die dasselbe Event durchreicht.
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel(`live-comments-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_comments',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          // Realtime-Payload kommt direkt aus Postgres-WAL — verwendet die
          // echten DB-Spaltennamen, nicht die PostgREST-Aliase. DB-Spalte
          // heißt `text` (siehe `supabase/live_studio.sql:45`). Wir mappen
          // `raw.text` unten auf das UI-Feld `body`, damit der Render-Pfad
          // mit dem SSR-Pfad (`getLiveComments`, der via `body:text` aliast)
          // konsistent bleibt.
          const raw = payload.new as {
            id: string;
            session_id: string;
            user_id: string;
            text: string;
            created_at: string;
            pinned?: boolean;
          };

          // Author-Profile lazy holen (nicht im Realtime-Event enthalten)
          const { data: profile } = await supabase
            .from('profiles')
            // `verified:is_verified` — DB-Spalte heißt `is_verified` (Migration
            // 20260407010000_creator_analytics), ohne Alias schlägt der SELECT
            // still fehl und Realtime-Chat-Kommentare rendern ohne Author-Profil.
            .select('id, username, display_name, avatar_url, verified:is_verified')
            .eq('id', raw.user_id)
            .maybeSingle();

          const withAuthor: LiveCommentWithAuthor = {
            id: raw.id,
            session_id: raw.session_id,
            user_id: raw.user_id,
            body: raw.text,
            created_at: raw.created_at,
            pinned: raw.pinned ?? false,
            author: profile
              ? {
                  id: profile.id,
                  username: profile.username,
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url,
                  verified: profile.verified ?? false,
                }
              : null,
          };

          setComments((prev) => {
            // Dedup (Optimistic-Update-Kollision)
            if (prev.some((c) => c.id === withAuthor.id)) return prev;
            const next = [...prev, withAuthor];
            // Cap auf 500 Nachrichten im Memory
            return next.length > 500 ? next.slice(-500) : next;
          });
        },
      )
      // v1.w.UI.139 — UPDATE: pinned state changes propagate in real-time
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_comments',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const raw = payload.new as { id: string; pinned?: boolean };
          setComments((prev) =>
            prev.map((c) => (c.id === raw.id ? { ...c, pinned: raw.pinned ?? false } : c)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // -----------------------------------------------------------------------------
  // Auto-Scroll: nur wenn User schon bei bottom ist (nicht reißen beim Hochscrollen)
  // -----------------------------------------------------------------------------
  const wasAtBottomRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (wasAtBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments]);

  // v1.w.UI.226 — Also auto-scroll when system messages arrive
  useEffect(() => {
    if (wasAtBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [localSystemMessages]);

  // v1.w.UI.139 — Slow-mode countdown
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => setCooldownLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  // -----------------------------------------------------------------------------
  // Send-Handler
  // -----------------------------------------------------------------------------
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !viewerId || ended || cooldownLeft > 0) return;

    setSendError(null);
    startTransition(async () => {
      const result = await sendLiveComment(sessionId, trimmed);
      if (!result.ok) {
        setSendError(result.error);
        return;
      }
      setText('');
      if (slowModeSeconds > 0) setCooldownLeft(slowModeSeconds);
      // Bei Shadow-Ban: Lokal anzeigen, damit der Troll nicht merkt, dass
      // niemand ihn sieht. Native macht dasselbe.
      if (result.data.shadowBanned) {
        const localGhost: LiveCommentWithAuthor = {
          id: `ghost-${Date.now()}`,
          session_id: sessionId,
          user_id: viewerId,
          body: trimmed,
          created_at: new Date().toISOString(),
          pinned: false,
          author: null,
        };
        setComments((prev) => [...prev, localGhost]);
      }
    });
  };

  // -----------------------------------------------------------------------------
  // Timeout-Handler (nur für Mods/Host)
  // -----------------------------------------------------------------------------
  const canModerate = isHost || isModerator;

  const handleTimeout = (targetUserId: string, seconds: number) => {
    startTransition(async () => {
      const result = await timeoutChatUser(sessionId, targetUserId, seconds);
      if (!result.ok) {
        setSendError(result.error);
      }
    });
  };

  // v1.w.UI.139 — Pin/Unpin handlers (for host + mods)
  const handlePin = (commentId: string) => {
    setComments((prev) => prev.map((c) => ({ ...c, pinned: c.id === commentId })));
    startTransition(async () => {
      const result = await pinLiveComment(sessionId, commentId);
      if (!result.ok) {
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, pinned: false } : c)));
        setSendError(result.error);
      }
    });
  };

  const handleUnpin = () => {
    setComments((prev) => prev.map((c) => ({ ...c, pinned: false })));
    startTransition(async () => {
      const result = await unpinLiveComment(sessionId);
      if (!result.ok) setSendError(result.error);
    });
  };

  const pinned = useMemo(() => comments.find((c) => c.pinned), [comments]);

  // v1.w.UI.197 — sidebar chat username tap → user profile mini-panel
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUserInfo | null>(null);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Chat</h2>
        {slowModeSeconds > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Slow-Mode: {slowModeSeconds}s
          </span>
        )}
      </div>

      {/* Pinned Comment */}
      {pinned && (
        <div className="border-b bg-primary/5 px-3 py-2 text-xs">
          <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            📌 Angepinnt
          </div>
          <p className="text-foreground">
            <span className="font-semibold">{pinned.author?.username ?? 'Anonym'}:</span>{' '}
            {pinned.body}
          </p>
        </div>
      )}

      {/* Liste */}
      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm"
      >
        {comments.length === 0 ? (
          <p className="pt-8 text-center text-xs text-muted-foreground">
            Sei der Erste im Chat.
          </p>
        ) : (
          <>
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                isHostMsg={c.user_id === hostId}
                canModerate={canModerate && c.user_id !== hostId && c.user_id !== viewerId}
                onTimeout={(secs) => handleTimeout(c.user_id, secs)}
                onPin={() => handlePin(c.id)}
                onUnpin={handleUnpin}
                onUserClick={
                  c.user_id !== viewerId && c.author
                    ? () =>
                        setSelectedChatUser({
                          id: c.user_id,
                          username: c.author!.username ?? '',
                          display_name: c.author!.display_name ?? null,
                          avatar_url: c.author!.avatar_url ?? null,
                          verified: c.author!.verified ?? false,
                        })
                    : undefined
                }
              />
            ))}
            {/* v1.w.UI.226 — Local system messages (follower shoutouts, etc.)
                Not persisted to DB — parity with native sendSystemEvent(). */}
            {localSystemMessages?.map((msg, i) => (
              <div
                key={`sys-${i}`}
                className="py-0.5 text-center text-[11px] italic text-muted-foreground"
              >
                {msg}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Compose */}
      {viewerId ? (
        ended ? (
          <div className="border-t px-3 py-3 text-center text-xs text-muted-foreground">
            Stream beendet.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 border-t px-3 py-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, INPUT_MAX))}
              placeholder={cooldownLeft > 0 ? `Warte ${cooldownLeft}s…` : 'Schreib was…'}
              className="min-w-0 flex-1 rounded-full border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              disabled={isPending || cooldownLeft > 0}
              maxLength={INPUT_MAX}
            />
            <button
              type="submit"
              disabled={isPending || !text.trim() || cooldownLeft > 0}
              className="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              aria-label="Senden"
            >
              {cooldownLeft > 0 ? (
                <span className="text-[11px] font-bold tabular-nums">{cooldownLeft}</span>
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>
        )
      ) : (
        <div className="border-t px-3 py-3 text-center text-xs text-muted-foreground">
          Einloggen um mitzuschreiben.
        </div>
      )}

      {sendError && (
        <div className="border-t bg-red-500/10 px-3 py-2 text-xs text-red-500">{sendError}</div>
      )}

      {/* v1.w.UI.197 — user profile panel (overlays the sidebar when a username is tapped) */}
      {selectedChatUser && (
        <LiveChatUserPanel
          user={selectedChatUser}
          viewerId={viewerId}
          sessionId={sessionId}
          canModerate={canModerate}
          isHost={isHost}
          hostId={hostId}
          className="absolute inset-x-2 bottom-[4.5rem] z-10"
          onClose={() => setSelectedChatUser(null)}
          onMention={(username) => {
            setText(`@${username} `);
            setSelectedChatUser(null);
          }}
          onTimeout={(secs) => {
            handleTimeout(selectedChatUser.id, secs);
            setSelectedChatUser(null);
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CommentRow — einzelne Nachricht. Host hat Badge, Mods können Timeout geben.
// v1.w.UI.197 — username is now a tappable button (opens LiveChatUserPanel).
// -----------------------------------------------------------------------------

function CommentRow({
  comment,
  isHostMsg,
  canModerate,
  onTimeout,
  onPin,
  onUnpin,
  onUserClick,
}: {
  comment: LiveCommentWithAuthor;
  isHostMsg: boolean;
  canModerate: boolean;
  onTimeout: (seconds: number) => void;
  onPin: () => void;
  onUnpin: () => void;
  onUserClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const name = comment.author?.display_name ?? comment.author?.username ?? 'Anonym';

  return (
    <div className="group relative flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onUserClick}
          disabled={!onUserClick}
          className={`mr-1.5 text-xs font-semibold ${
            isHostMsg ? 'text-primary' : 'text-foreground/80'
          } ${onUserClick ? 'cursor-pointer hover:underline underline-offset-2' : 'cursor-default'}`}
        >
          {name}
          {isHostMsg && (
            <span className="ml-1 rounded-sm bg-primary/20 px-1 py-0.5 text-[9px] uppercase tracking-wider text-primary">
              Host
            </span>
          )}
          {comment.author?.verified && (
            <span className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
              ✓
            </span>
          )}
          :
        </button>
        <span className="break-words text-foreground">{comment.body}</span>
      </div>

      {canModerate && (
        <div className="relative flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Moderieren"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-md border bg-popover text-xs shadow-lg">
              {/* Pin / Unpin — v1.w.UI.139 */}
              <button
                type="button"
                onClick={() => {
                  comment.pinned ? onUnpin() : onPin();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
              >
                {comment.pinned ? (
                  <><PinOff className="h-3 w-3 flex-shrink-0" />Entpinnen</>
                ) : (
                  <><Pin className="h-3 w-3 flex-shrink-0" />Anpinnen</>
                )}
              </button>
              <div className="h-px bg-border" />
              {[
                { label: '1 Min', secs: 60 },
                { label: '5 Min', secs: 300 },
                { label: '10 Min', secs: 600 },
                { label: '1 Std', secs: 3600 },
              ].map((opt) => (
                <button
                  key={opt.secs}
                  type="button"
                  onClick={() => {
                    onTimeout(opt.secs);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                >
                  Timeout {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
