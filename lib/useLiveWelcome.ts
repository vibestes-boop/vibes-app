/**
 * lib/useLiveWelcome.ts
 *
 * v1.24.0 — TikTok-Style Welcome-Toast beim Live-Join
 *
 * Zeigt "✨ @username hat den Stream betreten" am unteren Rand des
 * Chats, wenn ein Follower oder Top-Fan die Session betritt. Das
 * Backend-Filtern übernimmt die RPC `try_welcome_viewer`:
 *   • Nur aktive Sessions
 *   • Nur Follower-of-Host oder User mit jemals-Gifts-an-Host
 *   • Pro (Session, User) genau EIN Welcome, egal wie oft gejoint wird
 *
 * Broadcast läuft über den bestehenden `live-comments-{sessionId}`
 * Channel (Event `welcome-join`) — spart eine zusätzliche Subscription.
 *
 * Zwei Rollen:
 *   • Viewer ruft `useLiveWelcome(sessionId, { announceSelf: true })`
 *     → meldet sich selbst einmal an und hört auf andere Welcomes.
 *   • Host ruft `useLiveWelcome(sessionId, { announceSelf: false })`
 *     → hört nur und rendert dieselbe Toast-Queue.
 *
 * Die Queue hat pro-Eintrag eine TTL (~4s) und zeigt max 3 gestapelte
 * Toasts gleichzeitig, um Spam bei Stream-Start zu vermeiden.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type WelcomeTier = 'follower' | 'top_fan';

export interface WelcomeEvent {
  /** Stabile ID für React-Keys + Dedup (sessionId + userId + ts) */
  key: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  tier: WelcomeTier;
  /** Zeitpunkt an dem der Toast eingereiht wurde — für TTL */
  enqueuedAt: number;
}

/** Wie lange ein Welcome-Toast sichtbar bleibt (ms). */
const TOAST_TTL_MS = 4000;

/** Wie viele Welcomes gleichzeitig gestapelt werden (ältester fliegt raus). */
const MAX_QUEUE_SIZE = 3;

/**
 * Delay bevor der Viewer sich selbst welcomen lässt. Gibt der parallel
 * laufenden `join_live_session`-RPC + der Channel-Subscription Zeit,
 * damit andere Viewer unser Broadcast auch tatsächlich empfangen.
 */
const SELF_WELCOME_DELAY_MS = 800;

export function useLiveWelcome(
  sessionId: string | null | undefined,
  opts: { announceSelf: boolean } = { announceSelf: false },
) {
  const [welcomes, setWelcomes] = useState<WelcomeEvent[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Dedup auf Client-Seite: falls Broadcast durch Re-Subscribe doppelt
  // ankommt, zeigen wir den Toast trotzdem nur einmal.
  const seenKeysRef = useRef<Set<string>>(new Set());
  const announceSelf = opts.announceSelf;

  // ── Subscribe + ggf. Self-Announce ────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let selfAnnounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`live-comments-${sessionId}`)
      .on(
        'broadcast',
        { event: 'welcome-join' },
        (payload) => {
          if (cancelled) return;
          const data = payload.payload as {
            userId?: string;
            username?: string;
            avatarUrl?: string | null;
            tier?: WelcomeTier;
            ts?: number;
          } | null;
          if (!data?.userId || !data.username || !data.tier) return;

          const ts = typeof data.ts === 'number' ? data.ts : Date.now();
          const key = `${data.userId}-${ts}`;
          if (seenKeysRef.current.has(key)) return;
          seenKeysRef.current.add(key);

          setWelcomes((prev) => {
            const next = [
              ...prev,
              {
                key,
                userId: data.userId!,
                username: data.username!,
                avatarUrl: data.avatarUrl ?? null,
                tier: data.tier!,
                enqueuedAt: Date.now(),
              } as WelcomeEvent,
            ];
            // Stapel begrenzen — ältester fliegt raus.
            return next.length > MAX_QUEUE_SIZE
              ? next.slice(next.length - MAX_QUEUE_SIZE)
              : next;
          });
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (!announceSelf) return;

        // Selbst-Ankündigung: leicht verzögert damit Channel sicher
        // joint ist und andere Clients uns empfangen.
        selfAnnounceTimer = setTimeout(() => {
          if (cancelled) return;
          void runSelfWelcome(sessionId, channel);
        }, SELF_WELCOME_DELAY_MS);
      });

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (selfAnnounceTimer) clearTimeout(selfAnnounceTimer);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, announceSelf]);

  // ── TTL-basierte Auto-Evict ───────────────────────────────────────
  useEffect(() => {
    if (welcomes.length === 0) return;
    const tick = setInterval(() => {
      const now = Date.now();
      setWelcomes((prev) => {
        const filtered = prev.filter((w) => now - w.enqueuedAt < TOAST_TTL_MS);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 500);
    return () => clearInterval(tick);
  }, [welcomes.length]);

  // Public helper falls ein Caller explizit einen Toast dismissen will
  // (z.B. per Swipe). Aktuell ungenutzt, aber günstig bereitzustellen.
  const dismiss = useCallback((key: string) => {
    setWelcomes((prev) => prev.filter((w) => w.key !== key));
  }, []);

  return { welcomes, dismiss };
}

/**
 * Selbst-Welcome: ruft die RPC, und wenn ein Tier zurückkommt
 * broadcastet der Client das Event auf dem laufenden Channel.
 * Bleibt still bei Fehlern — kein Toast ist besser als ein falscher.
 */
async function runSelfWelcome(
  sessionId: string,
  channel: ReturnType<typeof supabase.channel>,
): Promise<void> {
  try {
    const { profile } = useAuthStore.getState();
    if (!profile?.id) return; // Anon → still

    const { data, error } = await supabase.rpc('try_welcome_viewer', {
      p_session_id: sessionId,
    });

    if (error) {
      __DEV__ && console.warn('[useLiveWelcome] try_welcome_viewer failed:', error.message);
      return;
    }

    // RPC liefert jsonb — je nach Supabase-Client-Version als String
    // oder Object parsed. Beide Pfade abdecken.
    const parsed: {
      tier?: WelcomeTier | null;
      user_id?: string;
      username?: string;
      avatar_url?: string | null;
    } | null =
      typeof data === 'string' ? (safeJson(data) as any) : (data as any);

    if (!parsed || !parsed.tier) return; // Nicht qualifiziert / schon welcomed.

    await channel.send({
      type: 'broadcast',
      event: 'welcome-join',
      payload: {
        userId:    parsed.user_id ?? profile.id,
        username:  parsed.username ?? profile.username,
        avatarUrl: parsed.avatar_url ?? profile.avatar_url ?? null,
        tier:      parsed.tier,
        ts:        Date.now(),
      },
    });
  } catch (err) {
    // Welcome-Toast ist non-critical — Sentry nur mit Tag, keine User-
    // sichtbare Fehlermeldung.
    Sentry.captureException(err, { tags: { feature: 'live-welcome' } });
  }
}

function safeJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
