'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, ShieldAlert, Pin, PinOff } from 'lucide-react';
import { sendLiveComment, timeoutChatUser, pinLiveComment, unpinLiveComment } from '@/app/actions/live';
import type { LiveCommentWithAuthor } from '@/lib/data/live';
import { cn } from '@/lib/utils';
import { LiveChatUserPanel } from './live-chat-user-panel';
import type { ChatUserInfo } from './live-chat-user-panel';
import {
  LIVE_COMMENT_BROADCAST_EVENT,
  APP_LIVE_COMMENT_EVENT,
  appLiveCommentChannelName,
  toAppBroadcastComment,
  createOptimisticLiveComment,
  mergeLiveComment,
  replaceOptimisticLiveComment,
  type LiveCommentBroadcastPayload,
} from './live-chat-messages';
import { createLiveRealtimeTopic } from './realtime-topic';

// -----------------------------------------------------------------------------
// LiveChatOverlay — Short-Video-style Chat als halbtransparentes Overlay. Ersetzt
// die Sidebar-Variante (`LiveChat`) im Viewer-Page. Unterschiede zur Sidebar:
//
//  • Render: Message-Pills statt Listrows. `bg-black/55 backdrop-blur-md`
//    lesbar gegen wechselnde Video-Luminanz.
//  • Mask-Fade: Top der Message-Liste blendet in Transparenz aus, damit ältere
//    Messages optisch in den Video-Canvas "auslaufen".
//  • Compose-Input: floating pill unten, `pointer-events-auto`, Outer-Container
//    `pointer-events-none` damit User auf den Video-Canvas (Play/Pause-Hit-Area)
//    tappen kann ohne vom Chat geblockt zu werden.
//  • Kein Card/Border-Background — die Video-Ebene IST der Background.
//
// Die Realtime-/Send-/Moderation-Logik ist funktional identisch zum
// `LiveChat`-Original (bewusst dupliziert statt Shared-Hook — der sidebar-
// variant lebt noch im Host-Deck und wir wollen die beiden Call-Sites
// unabhängig evolvieren können).
//
// v1.w.UI.191 — MOD + ★ TOP-Gifter-Badges auf einzelnen Nachrichten.
// Mobile-Parity: watch/[id].tsx zeigt HOST / 🛡 MOD / ★ TOP Badges in der
// CommentRow. Web hatte nur den HOST-Badge. Jetzt:
//   • modIds Set — via live_moderators INSERT/DELETE Realtime
//   • gifterMap Map<userId,coins> — via gift_transactions INSERT + initial snapshot
//   • topGifterIds = top-3 nach total coins (useMemo über gifterMap)
// Beide Sets werden direkt in dieser Datei gehalten (kein shared hook) um
// die beiden Chat-Varianten (Overlay vs. Sidebar) unabhängig zu halten.
// -----------------------------------------------------------------------------

export interface LiveChatOverlayProps {
  sessionId: string;
  initialComments: LiveCommentWithAuthor[];
  hostId: string;
  viewerId: string | null;
  isHost: boolean;
  isModerator: boolean;
  slowModeSeconds: number;
  ended: boolean;
  /** v1.w.UI.185 — wenn false: Kommentare sind für alle Viewer gesperrt (Input disabled). */
  allowComments?: boolean;
  /** v1.w.UI.188 — optionaler Grund-Text für den gesperrten Chat (z.B. "Nur Follower können chatten."). */
  commentsLockedLabel?: string;
  className?: string;
}

const INPUT_MAX = 200;
// Overlay-Render zeigt nur die letzten N Nachrichten — bei Spam wäre eine
// 500er-Liste optisch nur Noise. Stream-Kontext (Viewer weiß nicht was vor
// 500 Messages war) rechtfertigt das harte Cap.
const OVERLAY_VISIBLE = 30;

type LiveCommentHydrationRow = {
  id: string;
  session_id: string;
  user_id: string;
  body: string | null;
  pinned: boolean | null;
  created_at: string;
  author:
    | {
        id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
        verified: boolean | null;
      }
    | Array<{
        id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
        verified: boolean | null;
      }>
    | null;
};

function mapHydratedComment(row: LiveCommentHydrationRow): LiveCommentWithAuthor {
  const author = Array.isArray(row.author) ? (row.author[0] ?? null) : row.author;

  return {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    body: row.body ?? '',
    pinned: Boolean(row.pinned),
    created_at: row.created_at,
    author: author
      ? {
          id: author.id,
          username: author.username ?? '',
          display_name: author.display_name,
          avatar_url: author.avatar_url,
          verified: Boolean(author.verified),
        }
      : null,
  };
}

export function LiveChatOverlay({
  sessionId,
  initialComments,
  hostId,
  viewerId,
  isHost,
  isModerator,
  slowModeSeconds,
  ended,
  allowComments = true,
  commentsLockedLabel,
  className,
}: LiveChatOverlayProps) {
  const [comments, setComments] = useState<LiveCommentWithAuthor[]>(initialComments);
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // v1.w.UI.139 — Slow-mode client-side countdown after successful send.
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const broadcastCommentRef = useRef<((comment: LiveCommentWithAuthor) => void) | null>(null);
  // App-Vertrag-Channel (`live-comments-${id}`) — auch für Mod-Events (Timeout/Pin),
  // damit native App-Viewer auf Web-Moderation reagieren (App hört nur Broadcast).
  const appBroadcastRef = useRef<{ send: (msg: { type: 'broadcast'; event: string; payload: unknown }) => unknown } | null>(null);
  const refreshInFlightRef = useRef(false);

  const mergePersistedComments = useCallback((incoming: LiveCommentWithAuthor[]) => {
    if (incoming.length === 0) return;
    setComments((prev) => incoming.reduce((next, comment) => mergeLiveComment(next, comment), prev));
  }, []);

  useEffect(() => {
    setComments((prev) => {
      const scoped = prev.filter((comment) => comment.session_id === sessionId);
      return initialComments.reduce((next, comment) => mergeLiveComment(next, comment), scoped);
    });
  }, [initialComments, sessionId]);

  const refreshPersistedComments = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data, error } = await supabase
        .from('live_comments')
        .select(
          `id, session_id, user_id, body:text, pinned, created_at,
           author:profiles!live_comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
        )
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(120);

      if (error) {
        console.warn('[LiveChatOverlay] persisted comment refresh failed', error);
        return;
      }

      const hydrated = ((data ?? []) as unknown as LiveCommentHydrationRow[]).map(mapHydratedComment);
      mergePersistedComments(hydrated);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [mergePersistedComments, sessionId]);

  useEffect(() => {
    void refreshPersistedComments();
  }, [refreshPersistedComments]);

  useEffect(() => {
    const refreshOnRestore = () => {
      void refreshPersistedComments();
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') void refreshPersistedComments();
    };

    window.addEventListener('pageshow', refreshOnRestore);
    window.addEventListener('focus', refreshOnRestore);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      window.removeEventListener('pageshow', refreshOnRestore);
      window.removeEventListener('focus', refreshOnRestore);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [refreshPersistedComments]);

  // v1.w.UI.191 — Mod IDs + top-gifter IDs for message badges.
  const [modIds, setModIds] = useState<Set<string>>(new Set());
  // gifterMap: userId → total coins gifted in this session
  const [gifterMap, setGifterMap] = useState<Map<string, number>>(new Map());
  // Derive top-3 gifter ID set (re-sorted only when gifterMap changes)
  const topGifterIds = useMemo(() => {
    const sorted = [...gifterMap.entries()].sort((a, b) => b[1] - a[1]);
    return new Set(sorted.slice(0, 3).map(([uid]) => uid));
  }, [gifterMap]);

  // ---------------------------------------------------------------------------
  // Realtime: eigener Topic pro Overlay-Instanz, damit mehrere Chat-Views
  // dieselbe Session abonnieren koennen ohne Supabase-Topic-Kollision.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let changesChannel: ReturnType<typeof supabase.channel> | null = null;
    let broadcastChannel: ReturnType<typeof supabase.channel> | null = null;
    let appBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;

    try {
      const topic = `live-comments-overlay-${sessionId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      changesChannel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'live_comments',
            filter: `session_id=eq.${sessionId}`,
          },
          async (payload) => {
            const raw = payload.new as {
              id: string;
              session_id: string;
              user_id: string;
              text: string;
              created_at: string;
              pinned?: boolean;
            };

            const { data: profile } = await supabase
              .from('profiles')
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

            setComments((prev) => mergeLiveComment(prev, withAuthor));
          },
        )
        // v1.w.UI.139 — UPDATE subscription: pinned field changes propagate in real-time.
        // Host/mod calls pin_live_comment/unpin_live_comment → row UPDATE → banner refreshes.
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

      broadcastChannel = supabase
        .channel(`live-comments-broadcast-${sessionId}`, {
          config: { broadcast: { ack: false, self: false } },
        })
        .on('broadcast', { event: LIVE_COMMENT_BROADCAST_EVENT }, (payload) => {
          const incoming = (payload.payload as LiveCommentBroadcastPayload | null)?.comment;
          if (!incoming?.id) return;
          setComments((prev) => mergeLiveComment(prev, incoming));
        })
        .subscribe();

      // Cross-Platform-Bridge: native App-Viewer hören Live-Kommentare NUR über
      // diesen Channel/Event (anderer Name als der Web-Broadcast oben, kein
      // postgres_changes in der App). Web hört hier selbst NICHT mit → keine
      // Doppelung. Gespiegelt wird unten in broadcastCommentRef.
      appBroadcastChannel = supabase
        .channel(appLiveCommentChannelName(sessionId), {
          config: { broadcast: { ack: false, self: false } },
        })
        .subscribe();
      appBroadcastRef.current = appBroadcastChannel;

      broadcastCommentRef.current = (comment) => {
        void broadcastChannel?.send({
          type: 'broadcast',
          event: LIVE_COMMENT_BROADCAST_EVENT,
          payload: { comment },
        });
        void appBroadcastChannel?.send({
          type: 'broadcast',
          event: APP_LIVE_COMMENT_EVENT,
          payload: toAppBroadcastComment(comment),
        });
      };
    } catch (error) {
      console.warn('[LiveChatOverlay] realtime subscription disabled', error);
    }

    return () => {
      broadcastCommentRef.current = null;
      appBroadcastRef.current = null;
      if (changesChannel) supabase.removeChannel(changesChannel);
      if (broadcastChannel) supabase.removeChannel(broadcastChannel);
      if (appBroadcastChannel) supabase.removeChannel(appBroadcastChannel);
    };
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Auto-Scroll: in der Overlay-Variante wollen wir IMMER an bottom sein, da
  // User nicht zurückscrollen kann (mask-fade + kein visible scrollbar).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments]);

  // ---------------------------------------------------------------------------
  // v1.w.UI.139 — Slow-mode countdown: decrement every second until 0.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => setCooldownLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  // ---------------------------------------------------------------------------
  // v1.w.UI.191 — Moderator IDs subscription.
  // Initial load + INSERT/DELETE realtime so mod badges appear/disappear live.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let cancelled = false;

    // Initial snapshot
    supabase
      .from('live_moderators')
      .select('user_id')
      .eq('session_id', sessionId)
      .then(({ data }) => {
        if (cancelled || !data?.length) return;
        setModIds(new Set(data.map((r: { user_id: string }) => r.user_id)));
      });

    const ch = supabase
      .channel(createLiveRealtimeTopic('live-mods-overlay', sessionId))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_moderators', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const uid = (payload.new as { user_id?: string }).user_id;
          if (uid) setModIds((prev) => { const s = new Set(prev); s.add(uid); return s; });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_moderators', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const uid = (payload.old as { user_id?: string }).user_id;
          if (uid) setModIds((prev) => { const s = new Set(prev); s.delete(uid); return s; });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // v1.w.UI.191 — Top-Gifter IDs aggregator (same approach as LiveGiftLeaderboard).
  // Aggregates coin totals per sender for ★ TOP badge on the top-3 chatters.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (ended) {
      setGifterMap(new Map());
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let cancelled = false;

    // Initial snapshot — accumulate historical gifts so late-joiners see correct badges.
    supabase
      .from('gift_transactions')
      .select('sender_id, coin_cost')
      .eq('live_session_id', sessionId)
      .then(({ data }) => {
        if (cancelled || !data?.length) return;
        setGifterMap(() => {
          const m = new Map<string, number>();
          for (const row of data as Array<{ sender_id: string; coin_cost: number }>) {
            m.set(row.sender_id, (m.get(row.sender_id) ?? 0) + row.coin_cost);
          }
          return m;
        });
      });

    const giftTopic = `live-gifts-overlay-${sessionId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const ch = supabase
      .channel(giftTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
          filter: `live_session_id=eq.${sessionId}`,
        },
        (payload) => {
          const { sender_id, coin_cost } = payload.new as { sender_id: string; coin_cost: number };
          if (sender_id && coin_cost) {
            setGifterMap((prev) => {
              const next = new Map(prev);
              next.set(sender_id, (next.get(sender_id) ?? 0) + coin_cost);
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [ended, sessionId]);

  // ---------------------------------------------------------------------------
  // Send-Handler (identisch zur Sidebar-Variante inkl. Shadow-Ban-Ghost).
  // ---------------------------------------------------------------------------
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !viewerId || ended || !allowComments || cooldownLeft > 0) return;

    setSendError(null);
    setText('');
    const optimistic = createOptimisticLiveComment(sessionId, viewerId, trimmed);
    setComments((prev) => mergeLiveComment(prev, optimistic));

    startTransition(async () => {
      const result = await sendLiveComment(sessionId, trimmed);
      if (!result.ok) {
        setComments((prev) => prev.filter((comment) => comment.id !== optimistic.id));
        setText((current) => (current.length > 0 ? current : trimmed));
        setSendError(result.error);
        return;
      }

      // Start client-side cooldown after successful send.
      if (slowModeSeconds > 0) setCooldownLeft(slowModeSeconds);
      if (result.data.shadowBanned) {
        return;
      }

      if (result.data.comment) {
        setComments((prev) => replaceOptimisticLiveComment(prev, optimistic.id, result.data.comment!));
        broadcastCommentRef.current?.(result.data.comment);
      }
    });
  };

  const canModerate = isHost || isModerator;

  // v1.w.UI.196 — Chat username tap → user profile mini-panel.
  // Mobile parity: tapping a username in watch/[id].tsx opens LiveUserSheet
  // (follow, mention, profile, mod actions). Same surface on web.
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUserInfo | null>(null);

  const handleTimeout = (targetUserId: string, seconds: number) => {
    startTransition(async () => {
      const result = await timeoutChatUser(sessionId, targetUserId, seconds);
      if (!result.ok) {
        setSendError(result.error);
        return;
      }
      // App-Vertrag spiegeln: native Viewer blenden den getimeouteten User aus.
      appBroadcastRef.current?.send({
        type: 'broadcast',
        event: 'chat-timeout',
        payload: { userId: targetUserId, untilTs: Date.now() + seconds * 1000 },
      });
    });
  };

  // v1.w.UI.139 — Pin/Unpin. Optimistic: flip pinned flag immediately,
  // revert on error. Server action calls pin_live_comment / unpin_live_comment RPC.
  const handlePin = (commentId: string) => {
    // Optimistic: set this comment as pinned, clear any previous pin
    setComments((prev) =>
      prev.map((c) => ({ ...c, pinned: c.id === commentId })),
    );
    const comment = comments.find((c) => c.id === commentId);
    startTransition(async () => {
      const result = await pinLiveComment(sessionId, commentId);
      if (!result.ok) {
        // Revert — re-fetch would be ideal but just clear optimistic state
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, pinned: false } : c)));
        setSendError(result.error);
        return;
      }
      // App-Vertrag spiegeln: native Viewer zeigen den angepinnten Kommentar.
      if (comment) {
        appBroadcastRef.current?.send({
          type: 'broadcast',
          event: 'pin-comment',
          payload: toAppBroadcastComment(comment),
        });
      }
    });
  };

  const handleUnpin = () => {
    setComments((prev) => prev.map((c) => ({ ...c, pinned: false })));
    startTransition(async () => {
      const result = await unpinLiveComment(sessionId);
      if (!result.ok) {
        setSendError(result.error);
        return;
      }
      // App-Vertrag spiegeln: native Viewer entfernen den Pin (null = unpin).
      appBroadcastRef.current?.send({ type: 'broadcast', event: 'pin-comment', payload: null });
    });
  };

  const pinned = useMemo(() => comments.find((c) => c.pinned), [comments]);
  // Letzte N Nachrichten für den Overlay-Render. Pinned wird separat oben
  // angezeigt, also aus der sichtbaren Liste raus filtern (sonst Duplikat).
  const visible = useMemo(
    () => comments.filter((c) => !c.pinned).slice(-OVERLAY_VISIBLE),
    [comments],
  );

  return (
    <div className={cn('pointer-events-none relative flex flex-col gap-2', className)}>
      {/* Pinned (immer sichtbar, nicht vom Mask-Fade betroffen) */}
      {pinned && (
        <div className="pointer-events-auto max-w-[85%] self-start rounded-2xl bg-black/70 px-3 py-1.5 text-[13px] text-white shadow-elevation-2 backdrop-blur-md ring-1 ring-white/20">
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
            Pin
          </span>
          <span className="font-semibold">
            {pinned.author?.username ?? 'Anonym'}:
          </span>{' '}
          {pinned.body}
        </div>
      )}

      {/* Message-Liste mit Mask-Fade nach oben. `mask-image` via arbitrary
          Tailwind-Value — kein Config-Extension nötig. */}
      <div
        ref={listRef}
        className="flex max-h-[42vh] flex-col gap-1.5 overflow-hidden [mask-image:linear-gradient(to_top,black_55%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_top,black_55%,transparent_100%)]"
      >
        {visible.length === 0 ? (
          <div className="pointer-events-auto max-w-[85%] self-start rounded-2xl bg-black/40 px-3 py-1.5 text-[12px] text-white/70 backdrop-blur-md">
            Sei der Erste im Chat.
          </div>
        ) : (
          visible.map((c) => (
            <OverlayRow
              key={c.id}
              comment={c}
              isHostMsg={c.user_id === hostId}
              isModMsg={c.user_id !== hostId && modIds.has(c.user_id)}
              isTopGifterMsg={topGifterIds.has(c.user_id)}
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
          ))
        )}
      </div>

      {/* Compose-Zeile (die einzige pointer-events-auto-Fläche im Chat-Bereich
          außer der einzelnen Pill-Hovers) */}
      {viewerId ? (
        ended ? null : !allowComments ? (
          // v1.w.UI.185/188 — Kommentare deaktiviert oder Follower-Only
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/40 backdrop-blur-md">
              {commentsLockedLabel ?? 'Kommentare deaktiviert'}
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="pointer-events-auto flex items-center gap-2"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, INPUT_MAX))}
              placeholder={
                cooldownLeft > 0
                  ? `Warte ${cooldownLeft}s…`
                  : slowModeSeconds > 0
                    ? `Slow-Mode ${slowModeSeconds}s…`
                    : 'Schreib was…'
              }
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-white placeholder-white/50 outline-none backdrop-blur-md transition-colors duration-fast ease-out-expo focus:border-white/40 focus:bg-black/70"
              disabled={isPending || cooldownLeft > 0}
              maxLength={INPUT_MAX}
              aria-label="Chat-Nachricht"
            />
            <button
              type="submit"
              disabled={isPending || !text.trim() || cooldownLeft > 0}
              className="relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-black shadow-elevation-2 transition-all duration-fast ease-out-expo hover:bg-white/90 disabled:opacity-40"
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
      ) : null}

      {sendError && (
        <div className="pointer-events-auto max-w-[85%] self-start rounded-xl bg-red-500/80 px-3 py-1.5 text-xs text-white backdrop-blur-md">
          {sendError}
        </div>
      )}

      {/* v1.w.UI.196 — User profile mini-panel (slides in above compose) */}
      {selectedChatUser && (
        <LiveChatUserPanel
          user={selectedChatUser}
          viewerId={viewerId}
          sessionId={sessionId}
          canModerate={canModerate}
          isHost={isHost}
          hostId={hostId}
          className="pointer-events-auto absolute bottom-full left-0 mb-2 w-64"
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
// OverlayRow — einzelne Message-Pill. Host-Messages bekommen einen zarten
// goldenen Ring + "Host"-Badge (statt des Sidebar-typischen Primary-Colored-
// Texts), damit sie sich auf dem dunklen Canvas absetzen.
// -----------------------------------------------------------------------------

function OverlayRow({
  comment,
  isHostMsg,
  isModMsg,
  isTopGifterMsg,
  canModerate,
  onTimeout,
  onPin,
  onUnpin,
  onUserClick,
}: {
  comment: LiveCommentWithAuthor;
  isHostMsg: boolean;
  /** v1.w.UI.191 — true wenn Absender ein aktiver Moderator dieser Session ist */
  isModMsg: boolean;
  /** v1.w.UI.191 — true wenn Absender unter den Top-3-Giftern dieser Session ist */
  isTopGifterMsg: boolean;
  canModerate: boolean;
  onTimeout: (seconds: number) => void;
  onPin: () => void;
  onUnpin: () => void;
  /** v1.w.UI.196 — called when the username badge is tapped */
  onUserClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const name = comment.author?.display_name ?? comment.author?.username ?? 'Anonym';

  return (
    <div className="group pointer-events-auto flex max-w-[88%] items-start gap-1 self-start">
      <div
        className={cn(
          'min-w-0 rounded-2xl px-3 py-1.5 text-[13px] leading-snug text-white shadow-elevation-1 backdrop-blur-md',
          isHostMsg
            ? 'bg-black/65 ring-1 ring-white/20'
            : isModMsg
              ? 'bg-black/60 ring-1 ring-white/15'
              : 'bg-black/55 ring-1 ring-white/10',
        )}
      >
        {/* v1.w.UI.196 — username is a tappable button (opens ChatUserPanel) */}
        <button
          type="button"
          onClick={onUserClick}
          disabled={!onUserClick}
          className={cn(
            'mr-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-white/90',
            onUserClick && 'cursor-pointer underline-offset-2 hover:text-white hover:underline',
          )}
        >
          {name}
          {isHostMsg && (
            <span className="rounded-sm bg-white/15 px-1 py-0.5 text-[10px] uppercase tracking-wider text-white/75">
              Host
            </span>
          )}
          {isModMsg && (
            <span className="rounded-sm bg-white/15 px-1 py-0.5 text-[10px] uppercase tracking-wider text-white/75">
              Mod
            </span>
          )}
          {isTopGifterMsg && (
            <span className="rounded-sm bg-white/15 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/75">
              Top
            </span>
          )}
          {comment.author?.verified && (
            <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-white/15 text-[9px] font-bold text-white/85">
              ✓
            </span>
          )}
          <span className="text-white/60">:</span>
        </button>
        <span className="break-words text-white">{comment.body}</span>
      </div>

      {canModerate && (
        <div className="relative flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full bg-black/55 p-1.5 text-white/70 backdrop-blur-md hover:bg-black/80 hover:text-white"
            aria-label="Moderieren"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-[80] mb-1 w-36 overflow-hidden rounded-xl bg-black/85 text-xs text-white shadow-elevation-3 ring-1 ring-white/10 backdrop-blur-md">
              {/* Pin / Unpin — v1.w.UI.139 */}
              <button
                type="button"
                onClick={() => {
                  if (comment.pinned) onUnpin();
                  else onPin();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10"
              >
                {comment.pinned ? (
                  <><PinOff className="h-3 w-3 flex-shrink-0" />Entpinnen</>
                ) : (
                  <><Pin className="h-3 w-3 flex-shrink-0" />Anpinnen</>
                )}
              </button>
              <div className="h-px bg-white/10" />
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
                  className="block w-full px-3 py-1.5 text-left hover:bg-white/10"
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
