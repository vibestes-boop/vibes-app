'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// -----------------------------------------------------------------------------
// LiveGiftAnimationLayer — v1.w.UI.17 (B3 Web-Parity)
//
// Subscribed auf `gift_transactions` INSERT-Events für eine Session. Pro eingegangenem
// Geschenk spawnt ein Card-Burst von unten-links nach oben mit leichtem
// horizontalen Drift, bleibt ~3s sichtbar und räumt sich selbst auf.
//
// Warum nicht Broadcast `live:{id}` Event `gift`?
//   Der bestehende `live-gifts-feed.tsx` (Host-Deck) subscribet auf
//   `postgres_changes` INSERT — gleiche Pfad-Semantik. Eine zweite
//   Broadcast-Subscription (selbe Daten, anderer Kanal) würde redundante
//   Realtime-Slots verbrauchen. Wir halten uns an `postgres_changes` für
//   die Web-Seite — das ist reproduzierbar, deduziert dieselben Felder,
//   und der Trigger broadcasted trotzdem (Native-App nutzt Broadcast).
//
// Performance:
//   • Max 5 concurrent bursts — ältere werden vorne abgeschnitten, damit
//     Spam (×50 Combo) keine DOM-Explosion erzeugt.
//   • Lane-System mit 3 festen Spalten (left-[12%], left-[36%], left-[60%])
//     damit gleichzeitige Gifts nicht übereinander liegen.
//   • `drift` als CSS-Variable random zwischen -24..+24px → natürliche
//     Varianz ohne pro-Burst-Keyframe-Regeneration.
//   • Meta-Lookups (sender + gift) lazy via Promise.all pro Event — wird
//     bei Gift-Spam nicht exponentiell teurer, bleibt O(1) pro Event.
//
// Accessibility:
//   • Gesamt-Container `aria-hidden="true"` — Screen-Reader bekommen
//     Gift-Info schon über `live-gifts-feed` (Host-Deck) bzw. kanonisch
//     via `live_comments`-ähnliche Notify-Channels (Phase später).
//   • Keyframes inline via `<style jsx global>`, kein Tailwind-Config-
//     Eingriff — identisches Muster zu `live-reaction-overlay.tsx`.
//
// Bewusst NICHT hier:
//   • Full-Lottie-Animations (wie Native). Web-Parität ist das Emoji/
//     Image-Burst. Lottie kann nachgezogen werden wenn UX-Tests mehr
//     Premium-Feel rechtfertigen (höheres Bundle-Kostenrisiko).
//   • Gift-Combo-Counter (×50). Wird auf Web erst sichtbar wenn Combos
//     als eigene Broadcast-Events kommen — aktuell kommt jeder Send
//     als einzelner INSERT, also ist jeder Burst = 1 Geschenk.
//   • Heavy gift physics. Der Layer bleibt bewusst leicht, damit Host und
//     Viewer denselben Effekt sehen ohne den Stream-Frame zu blockieren.
// -----------------------------------------------------------------------------

const MAX_BURSTS = 5;
const BURST_DURATION_MS = 3200;

export interface LiveGiftBurst {
  id: string;
  senderName: string;
  giftName: string;
  giftImage: string | null;
  giftEmoji?: string | null;
  coinCost: number;
  lane: 0 | 1 | 2;
  drift: number;
}

export interface LiveGiftAnimationLayerProps {
  sessionId: string;
  /**
   * Optional callback. Feuert für jeden erfolgreich eingegangenen Burst —
   * nützlich für externe Observer (Goal-Celebration-Hook, Analytics).
   */
  onBurst?: (burst: LiveGiftBurst) => void;
}

interface GiftBurstInput {
  id: string;
  senderName: string;
  giftName: string;
  giftImage?: string | null;
  giftEmoji?: string | null;
  coinCost: number;
}

interface LiveGiftSentEventDetail {
  sessionId: string;
  giftLogId?: string | null;
  senderName?: string | null;
  giftName: string;
  giftEmoji?: string | null;
  coinCost: number;
}

/**
 * Container-Komponente: hält Supabase-Subscription + Burst-State. Rendert
 * `LiveGiftAnimationView` mit der Live-Burst-Liste.
 */
export function LiveGiftAnimationLayer({ sessionId, onBurst }: LiveGiftAnimationLayerProps) {
  const [bursts, setBursts] = useState<LiveGiftBurst[]>([]);
  const channelInstanceId = useRef(Math.random().toString(36).slice(2));
  const seenBurstIdsRef = useRef(new Set<string>());

  const removeBurst = useCallback((id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const spawnBurst = useCallback(
    (input: GiftBurstInput) => {
      if (seenBurstIdsRef.current.has(input.id)) return;
      seenBurstIdsRef.current.add(input.id);

      const burst: LiveGiftBurst = {
        id: input.id,
        senderName: input.senderName.trim() || 'Unbekannt',
        giftName: input.giftName.trim() || 'Geschenk',
        giftImage: input.giftImage ?? null,
        giftEmoji: input.giftEmoji ?? null,
        coinCost: input.coinCost,
        lane: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        drift: -24 + Math.round(Math.random() * 48),
      };

      setBursts((prev) => {
        const next = [...prev, burst];
        return next.length > MAX_BURSTS ? next.slice(-MAX_BURSTS) : next;
      });
      onBurst?.(burst);

      window.setTimeout(() => {
        removeBurst(burst.id);
        seenBurstIdsRef.current.delete(burst.id);
      }, BURST_DURATION_MS);
    },
    [onBurst, removeBurst],
  );

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(`live-gifts-anim-${sessionId}-${channelInstanceId.current}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'gift_transactions',
            filter: `live_session_id=eq.${sessionId}`,
          },
          async (payload) => {
            const row = payload.new as {
              id: string;
              sender_id: string;
              gift_id: string;
              coin_cost: number;
            };

            // Sender + Gift-Metadata lazy nachladen — parallel.
            const [{ data: senderData }, { data: giftData }] = await Promise.all([
              supabase
                .from('profiles')
                .select('username, display_name')
                .eq('id', row.sender_id)
                .maybeSingle(),
              supabase
                .from('gift_catalog')
                .select('name, emoji')
                .eq('id', row.gift_id)
                .maybeSingle(),
            ]);

            if (cancelled) return;

            const sender = senderData as
              | { username: string | null; display_name: string | null }
              | null;
            const gift = giftData as { name: string | null; emoji: string | null } | null;

            spawnBurst({
              id: row.id,
              senderName:
                sender?.display_name?.trim() || sender?.username?.trim() || 'Unbekannt',
              giftName: gift?.name?.trim() || 'Geschenk',
              giftImage: null,
              giftEmoji: gift?.emoji ?? null,
              coinCost: row.coin_cost,
            });
          },
        )
        .subscribe();
    } catch (error) {
      console.warn('[LiveGiftAnimationLayer] realtime subscription disabled', error);
    }

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId, spawnBurst]);

  useEffect(() => {
    function handleLocalGift(event: Event) {
      const detail = (event as CustomEvent<LiveGiftSentEventDetail>).detail;
      if (!detail || detail.sessionId !== sessionId) return;

      spawnBurst({
        id: detail.giftLogId || `local-gift-${sessionId}-${Date.now()}`,
        senderName: detail.senderName?.trim() || 'Du',
        giftName: detail.giftName,
        giftImage: null,
        giftEmoji: detail.giftEmoji ?? null,
        coinCost: detail.coinCost,
      });
    }

    window.addEventListener('serlo:live-gift-sent', handleLocalGift);
    return () => window.removeEventListener('serlo:live-gift-sent', handleLocalGift);
  }, [sessionId, spawnBurst]);

  return <LiveGiftAnimationView bursts={bursts} />;
}

// -----------------------------------------------------------------------------
// Presentational-View — parametrisierbar. Für Tests direkt nutzbar ohne
// Supabase-Subscription-Mock.
// -----------------------------------------------------------------------------

const LANE_LEFT: Record<0 | 1 | 2, string> = {
  0: 'left-[10%]',
  1: 'left-[36%]',
  2: 'left-[60%]',
};

export function LiveGiftAnimationView({ bursts }: { bursts: LiveGiftBurst[] }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden="true"
      data-testid="gift-animation-layer"
    >
      {bursts.map((b) => (
        <LiveGiftBurstCard key={b.id} burst={b} />
      ))}
      {/* Keyframes inline — identische Strategie zu `live-reaction-overlay.tsx`.
          Vermeidet einen tailwind-config-Eingriff für einen so lokalen Effekt. */}
      <style jsx global>{`
        @keyframes gift-fly-up {
          0% {
            transform: translate(0, 40px) scale(0.55);
            opacity: 0;
          }
          15% {
            transform: translate(0, 0) scale(1.15);
            opacity: 1;
          }
          25% {
            transform: translate(0, -4px) scale(1);
            opacity: 1;
          }
          85% {
            transform: translate(var(--drift, 0), -240px) scale(1);
            opacity: 0.85;
          }
          100% {
            transform: translate(var(--drift, 0), -280px) scale(0.9);
            opacity: 0;
          }
        }
        .animate-gift-burst {
          animation: gift-fly-up 3.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LiveGiftBurstCard — einzelne schwebende Pille.
// -----------------------------------------------------------------------------

function LiveGiftBurstCard({ burst }: { burst: LiveGiftBurst }) {
  return (
    <div
      className={`absolute bottom-24 ${LANE_LEFT[burst.lane]} flex max-w-[60%] items-center gap-2 animate-gift-burst rounded-full bg-gradient-to-r from-amber-400/95 to-pink-500/95 px-3 py-1.5 shadow-elevation-3 ring-1 ring-white/20 backdrop-blur-sm`}
      style={{ ['--drift' as string]: `${burst.drift}px` } as React.CSSProperties}
      data-testid="gift-burst"
    >
      {burst.giftImage ? (
        // Plain `<img>` bewusst: externe Gift-Assets sind nicht zwingend in
        // `next.config` allowlisted.
        // `live-gifts-feed.tsx` nutzt dasselbe Muster für Konsistenz.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={burst.giftImage}
          alt=""
          className="h-9 w-9 flex-shrink-0 object-contain drop-shadow-sm"
        />
      ) : (
        <span className="text-3xl leading-none" aria-hidden="true">
          {burst.giftEmoji ?? '🎁'}
        </span>
      )}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[11px] font-bold text-white">{burst.senderName}</span>
        <span className="truncate text-[10px] text-white/95">
          {burst.giftName} · 🪙 {burst.coinCost.toLocaleString('de-DE')}
        </span>
      </div>
    </div>
  );
}
