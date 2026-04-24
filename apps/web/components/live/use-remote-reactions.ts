'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// -----------------------------------------------------------------------------
// useRemoteReactions — subscribe to other viewers' reactions on the
// `live:{sessionId}` broadcast channel and emit them as the same
// `burst: { key, id }` shape the local `LiveReactionOverlay` already consumes.
//
// Why: sendLiveReaction (app/actions/live.ts) already fires a broadcast
// event `reaction` with payload `{ reaction, user_id, ts }`. Until now,
// nobody subscribed to that on the client — each viewer saw ONLY their
// OWN floating hearts. The TikTok-parity moment is the confetti-storm of
// hundreds of strangers' reactions floating up in sync.
//
// Filters:
//  • `payload.user_id === viewerId` → self-echo; already shown optimistically
//    by the local state in LiveActionBar, so skip to avoid double-floats.
//  • `payload.reaction` not in ALLOWED_REACTIONS → defensive, protects the
//    LiveReactionOverlay which falls back to 'heart' but may drift if the
//    broadcast payload shape ever changes.
//
// IDs are generated client-side via a monotonic ref counter XOR-mixed with a
// small sessionId hash to guarantee uniqueness even if two remote payloads
// arrive in the same millisecond. `Date.now()` alone is not enough because
// the LiveReactionOverlay uses the id as a React key — duplicate keys would
// cause the animation to not re-trigger for the second emoji.
// -----------------------------------------------------------------------------

export const REMOTE_REACTION_KEYS = [
  'heart',
  'fire',
  'clap',
  'laugh',
  'wow',
  'sad',
] as const;

export type RemoteReactionKey = (typeof REMOTE_REACTION_KEYS)[number];

const ALLOWED = new Set<string>(REMOTE_REACTION_KEYS);

export interface RemoteReactionBurst {
  key: RemoteReactionKey;
  id: number;
}

export interface UseRemoteReactionsArgs {
  sessionId: string;
  viewerId: string;
  /** Optional toggle — tests/host-preview can disable the subscription. */
  enabled?: boolean;
}

export interface UseRemoteReactionsResult {
  burst: RemoteReactionBurst | null;
}

function hashSessionId(sessionId: string): number {
  // Simple FNV-1a-ish hash reduced to 16 bits — enough entropy to
  // disambiguate concurrent counter-ticks across tabs without a full
  // crypto dep.
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h & 0xffff;
}

export function useRemoteReactions({
  sessionId,
  viewerId,
  enabled = true,
}: UseRemoteReactionsArgs): UseRemoteReactionsResult {
  const [burst, setBurst] = useState<RemoteReactionBurst | null>(null);
  const counterRef = useRef(0);
  const sessionSaltRef = useRef(hashSessionId(sessionId));

  useEffect(() => {
    if (!enabled) return;
    if (!sessionId) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase.channel(`live:${sessionId}`);

    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const p = payload as {
        reaction?: string;
        user_id?: string;
        ts?: number;
      } | null;
      if (!p) return;
      if (!p.reaction || !ALLOWED.has(p.reaction)) return;
      // Self-echo: LiveActionBar already fired the optimistic local burst.
      if (p.user_id && p.user_id === viewerId) return;

      counterRef.current = (counterRef.current + 1) >>> 0;
      // Compose a unique id: high 16 bits = session-salt, next 16 bits =
      // monotonic counter, lowest 20 bits = ms-truncated timestamp.
      const id =
        (sessionSaltRef.current << 20) ^
        ((counterRef.current & 0xffff) << 4) ^
        (Date.now() & 0xfffff);

      setBurst({ key: p.reaction as RemoteReactionKey, id });
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, viewerId, enabled]);

  return { burst };
}
