'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { glassPillStrong } from '@/lib/ui/glass-pill';

// -----------------------------------------------------------------------------
// LiveGiftLeaderboard — Horizontal strip showing top 3 gifters during a stream.
//
// v1.w.UI.176 — Mobile parity: TikTok/Serlo native show a ranked "top gifters"
// row overlaid on the stream so viewers know who the biggest supporters are.
//
// Architecture:
//  • Subscribes to live_gifts INSERT (same filter as LiveGiftsFeed)
//  • Aggregates coins per sender_id via a local Map
//  • Derives top-3 sorted list via useMemo — no re-sorts on every render
//  • Initial snapshot via a small SSR-equivalent on mount (one DB read)
//    so late-joining viewers see the session history, not just gifts since load
// -----------------------------------------------------------------------------

interface GifterEntry {
  sender_id: string;
  username: string | null;
  avatar_url: string | null;
  coins: number;
}

const MEDALS = ['🥇', '🥈', '🥉'] as const;

export function LiveGiftLeaderboard({ sessionId }: { sessionId: string }) {
  const [gifters, setGifters] = useState<Map<string, GifterEntry>>(new Map());
  const mounted = useRef(false);

  // ── Initial snapshot: fetch existing gifts for this session on mount ──────
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const supabase = createClient();

    // One-time read of all gifts in this session so late-joiners see history.
    // We join profiles inline to get username + avatar without N+1.
    (async () => {
      const { data } = await supabase
        .from('live_gifts')
        .select(
          'id, sender_id, coin_cost, sender:profiles!live_gifts_sender_id_fkey ( username, avatar_url )',
        )
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!data?.length) return;

      setGifters((prev) => {
        const next = new Map(prev);
        for (const row of data as Array<{
          id: string;
          sender_id: string;
          coin_cost: number;
          sender: { username: string | null; avatar_url: string | null } | Array<{ username: string | null; avatar_url: string | null }> | null;
        }>) {
          const profile = Array.isArray(row.sender) ? (row.sender[0] ?? null) : row.sender;
          const existing = next.get(row.sender_id);
          if (existing) {
            existing.coins += row.coin_cost;
          } else {
            next.set(row.sender_id, {
              sender_id: row.sender_id,
              username: profile?.username ?? null,
              avatar_url: profile?.avatar_url ?? null,
              coins: row.coin_cost,
            });
          }
        }
        return next;
      });
    })();

    // ── Realtime subscription for new gifts ────────────────────────────────
    const channel = supabase
      .channel(`live-gift-lb-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_gifts',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const row = payload.new as {
            sender_id: string;
            coin_cost: number;
          };

          // Lazy-load sender profile if new gifter
          setGifters((prev) => {
            const next = new Map(prev);
            const existing = next.get(row.sender_id);
            if (existing) {
              // Already have profile data — just increment coins
              next.set(row.sender_id, { ...existing, coins: existing.coins + row.coin_cost });
              return next;
            }
            // New gifter — add with placeholder, profile fetched below
            next.set(row.sender_id, {
              sender_id: row.sender_id,
              username: null,
              avatar_url: null,
              coins: row.coin_cost,
            });
            return next;
          });

          // Fetch profile for new gifter (runs outside setState)
          const supabaseInner = createClient();
          const { data: profile } = await supabaseInner
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', row.sender_id)
            .maybeSingle();

          if (profile) {
            setGifters((prev) => {
              const next = new Map(prev);
              const entry = next.get(row.sender_id);
              if (entry) {
                next.set(row.sender_id, {
                  ...entry,
                  username: (profile as { username: string | null }).username,
                  avatar_url: (profile as { avatar_url: string | null }).avatar_url,
                });
              }
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // ── Top-3 sorted desc by coins ────────────────────────────────────────────
  const top3 = useMemo(
    () =>
      Array.from(gifters.values())
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 3),
    [gifters],
  );

  if (top3.length === 0) return null;

  return (
    <div
      aria-label="Top-Spender"
      className={cn(
        glassPillStrong,
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-elevation-1',
      )}
    >
      {top3.map((entry, idx) => (
        <div
          key={entry.sender_id}
          className="flex items-center gap-1"
          title={`${entry.username ?? 'Unbekannt'} · ${entry.coins.toLocaleString('de-DE')} 🪙`}
        >
          <span className="text-base leading-none" aria-hidden>
            {MEDALS[idx]}
          </span>
          {entry.avatar_url ? (
            <Image
              src={entry.avatar_url}
              alt={entry.username ?? 'Gifter'}
              width={20}
              height={20}
              className="rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold uppercase text-white">
              {(entry.username ?? '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="hidden text-[11px] font-semibold text-white/90 sm:inline">
            {entry.coins >= 1_000
              ? `${(entry.coins / 1_000).toFixed(1).replace(/\.0$/, '')}k`
              : entry.coins.toString()}
          </span>
        </div>
      ))}
    </div>
  );
}
