'use client';

// -----------------------------------------------------------------------------
// <LiveWelcomeToasts /> — v1.w.UI.192
//
// TikTok-Style "✨ @user hat den Stream betreten" toast-stack on the live
// viewer page. Mobile parity: components/live/WelcomeToast.tsx + lib/useLiveWelcome.ts
//
// Architecture (mirror of mobile):
//  • On mount (viewer only): calls `try_welcome_viewer` RPC after 800ms delay.
//    RPC checks: is caller a follower or top-fan of the host? If yes, returns
//    tier + profile data. Client then broadcasts `welcome-join` on the shared
//    `live-comments-{sessionId}` channel so other viewers see the toast.
//  • Subscribes to the same channel `welcome-join` broadcast events.
//  • Maintains a FIFO queue (max 3) with per-entry TTL of 4s. Older entries
//    auto-evict. Client-side dedup via seen-key Set.
//
// Props:
//  • sessionId — live session UUID
//  • viewerId  — null when viewer is anonymous (no self-announce)
//
// Placement: absolute bottom-0 left-0 — floating above the chat compose bar,
// below the message list. Pointer-events-none on wrapper so video taps pass
// through; individual toasts are inert (display-only).
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@/lib/utils';

type WelcomeTier = 'follower' | 'top_fan';

interface WelcomeEntry {
  key: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  tier: WelcomeTier;
  enqueuedAt: number;
}

const TOAST_TTL_MS = 4_000;
const MAX_QUEUE   = 3;
const SELF_DELAY  = 800; // ms — give channel time to subscribe

export function LiveWelcomeToasts({
  sessionId,
  viewerId,
}: {
  sessionId: string;
  viewerId: string | null;
}) {
  const [toasts, setToasts] = useState<WelcomeEntry[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // ── Subscribe + optional self-announce ───────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let cancelled = false;
    let selfTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`live-comments-${sessionId}`)
      .on(
        'broadcast',
        { event: 'welcome-join' },
        (payload) => {
          if (cancelled) return;
          const d = payload.payload as {
            userId?: string;
            username?: string;
            avatarUrl?: string | null;
            tier?: WelcomeTier;
            ts?: number;
          } | null;
          if (!d?.userId || !d.username || !d.tier) return;

          const ts  = typeof d.ts === 'number' ? d.ts : Date.now();
          const key = `${d.userId}-${ts}`;
          if (seenRef.current.has(key)) return;
          seenRef.current.add(key);

          setToasts((prev) => {
            const next: WelcomeEntry[] = [
              ...prev,
              {
                key,
                userId:    d.userId!,
                username:  d.username!,
                avatarUrl: d.avatarUrl ?? null,
                tier:      d.tier!,
                enqueuedAt: Date.now(),
              },
            ];
            return next.length > MAX_QUEUE
              ? next.slice(next.length - MAX_QUEUE)
              : next;
          });
        },
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !viewerId || cancelled) return;

        // Delay self-announce until channel is confirmed subscribed
        selfTimer = setTimeout(async () => {
          if (cancelled) return;
          try {
            const { data, error } = await supabase.rpc('try_welcome_viewer', {
              p_session_id: sessionId,
            });
            if (error || !data) return;

            // RPC may return parsed object or JSON string depending on client version
            type RpcResult = {
              tier?: WelcomeTier | null;
              user_id?: string;
              username?: string;
              avatar_url?: string | null;
            } | null;
            const parsed: RpcResult =
              typeof data === 'string'
                ? (safeJson(data) as RpcResult)
                : (data as unknown as RpcResult);

            if (!parsed?.tier) return; // Not a follower/top-fan, or already welcomed

            await channel.send({
              type:    'broadcast',
              event:   'welcome-join',
              payload: {
                userId:    parsed.user_id   ?? viewerId,
                username:  parsed.username  ?? 'Anonym',
                avatarUrl: parsed.avatar_url ?? null,
                tier:      parsed.tier,
                ts:        Date.now(),
              },
            });
          } catch {
            // Non-critical — swallow silently
          }
        }, SELF_DELAY);
      });

    return () => {
      cancelled = true;
      if (selfTimer) clearTimeout(selfTimer);
      supabase.removeChannel(channel);
    };
  }, [sessionId, viewerId]);

  // ── TTL eviction ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.enqueuedAt < TOAST_TTL_MS));
    }, 500);
    return () => clearInterval(id);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none flex flex-col gap-1.5"
      aria-live="polite"
      aria-label="Neue Viewer"
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          className={cn(
            'flex animate-in fade-in slide-in-from-left-4 duration-300',
            'max-w-[85%] items-center gap-2 self-start',
            'rounded-2xl px-3 py-1.5 backdrop-blur-md',
            t.tier === 'top_fan'
              ? 'bg-amber-500/20 ring-1 ring-amber-300/40'
              : 'bg-violet-500/20 ring-1 ring-violet-300/30',
          )}
        >
          {/* Avatar */}
          {t.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.avatarUrl}
              alt={t.username}
              className="h-5 w-5 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white',
                t.tier === 'top_fan' ? 'bg-amber-500/70' : 'bg-violet-500/70',
              )}
            >
              {t.username.charAt(0).toUpperCase()}
            </div>
          )}

          <span className="text-[12px] font-medium leading-snug text-white">
            {t.tier === 'top_fan' ? '👑' : '✨'}{' '}
            <span className="font-semibold">@{t.username}</span>
            {' '}
            <span className="opacity-80">hat den Stream betreten</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
