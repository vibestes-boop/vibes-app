'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AnimationItem } from 'lottie-web';
import { createBrowserClient } from '@supabase/ssr';
import { createLiveRealtimeTopic } from './realtime-topic';

// -----------------------------------------------------------------------------
// LiveGiftAnimationLayer — v1.w.UI.17 (B3 Web-Parity)
//
// Subscribed auf `gift_transactions` INSERT-Events für eine Session. Pro eingegangenem
// Geschenk spawnt einen großen Stage-Burst mit Aura/Sparkles und leichtem
// horizontalen Drift, bleibt ~4s sichtbar und räumt sich selbst auf.
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
//   • Keyframes inline via `<style>`, kein Tailwind-Config-
//     Eingriff — identisches Muster zu `live-reaction-overlay.tsx`.
//
// Bewusst leicht gehalten:
//   • Lottie/Video-Assets werden lazy geladen: keine Player-Library im
//     initialen Live-Bundle, aber echte Gift-Animation sobald ein Gift ankommt.
//   • Gift-Combo-Counter (×50). Wird auf Web erst sichtbar wenn Combos
//     als eigene Broadcast-Events kommen — aktuell kommt jeder Send
//     als einzelner INSERT, also ist jeder Burst = 1 Geschenk.
//   • Heavy gift physics. Der Layer bleibt bewusst leicht, damit Host und
//     Viewer denselben Effekt sehen ohne den Stream-Frame zu blockieren.
// -----------------------------------------------------------------------------

const MAX_BURSTS = 5;
const BURST_DURATION_MS = 5200;
const PREMIUM_VIDEO_FALLBACK_MS = 30000;

const LOCAL_GIFT_LOTTIE_URLS: Record<string, string> = {
  rose: '/lottie/gifts/rose.json',
  heart: '/lottie/gifts/heart.json',
  diamond: '/lottie/gifts/diamond.json',
  crown: '/lottie/gifts/crown.json',
  trophy: '/lottie/gifts/trophy.json',
  chechen_tower: '/lottie/gifts/chechen_tower.json',
};

const LOCAL_GIFT_VIDEO_URLS: Record<string, string> = {
  chechen_tower_premium: '/gifts/chechen_tower_premium.mp4',
};

export interface LiveGiftBurst {
  id: string;
  giftId: string | null;
  senderName: string;
  giftName: string;
  giftImage: string | null;
  giftEmoji?: string | null;
  giftLottieUrl?: string | null;
  giftVideoUrl?: string | null;
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
  giftId?: string | null;
  senderName: string;
  giftName: string;
  giftImage?: string | null;
  giftEmoji?: string | null;
  giftLottieUrl?: string | null;
  giftVideoUrl?: string | null;
  coinCost: number;
}

interface LiveGiftSentEventDetail {
  sessionId: string;
  giftLogId?: string | null;
  giftId?: string | null;
  senderName?: string | null;
  giftName: string;
  giftEmoji?: string | null;
  giftLottieUrl?: string | null;
  giftVideoUrl?: string | null;
  coinCost: number;
}

/**
 * Container-Komponente: hält Supabase-Subscription + Burst-State. Rendert
 * `LiveGiftAnimationView` mit der Live-Burst-Liste.
 */
export function LiveGiftAnimationLayer({ sessionId, onBurst }: LiveGiftAnimationLayerProps) {
  const [bursts, setBursts] = useState<LiveGiftBurst[]>([]);
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
        giftId: input.giftId ?? null,
        senderName: input.senderName.trim() || 'Unbekannt',
        giftName: input.giftName.trim() || 'Geschenk',
        giftImage: input.giftImage ?? null,
        giftEmoji: input.giftEmoji ?? null,
        giftLottieUrl: resolveGiftLottieUrl(input.giftId, input.giftLottieUrl),
        giftVideoUrl: resolveGiftVideoUrl(input.giftId, input.giftVideoUrl),
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
      }, burst.giftVideoUrl ? PREMIUM_VIDEO_FALLBACK_MS : BURST_DURATION_MS);
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
        .channel(createLiveRealtimeTopic('live-gifts-anim', sessionId))
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
                .select('name, emoji, lottie_url')
                .eq('id', row.gift_id)
                .maybeSingle(),
            ]);

            if (cancelled) return;

            const sender = senderData as
              | { username: string | null; display_name: string | null }
              | null;
            const gift = giftData as
              | { name: string | null; emoji: string | null; lottie_url: string | null }
              | null;

            spawnBurst({
              id: row.id,
              giftId: row.gift_id,
              senderName:
                sender?.display_name?.trim() || sender?.username?.trim() || 'Unbekannt',
              giftName: gift?.name?.trim() || 'Geschenk',
              giftImage: null,
              giftEmoji: gift?.emoji ?? null,
              giftLottieUrl: gift?.lottie_url ?? null,
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
        giftId: detail.giftId ?? null,
        senderName: detail.senderName?.trim() || 'Du',
        giftName: detail.giftName,
        giftImage: null,
        giftEmoji: detail.giftEmoji ?? null,
        giftLottieUrl: detail.giftLottieUrl ?? null,
        giftVideoUrl: detail.giftVideoUrl ?? null,
        coinCost: detail.coinCost,
      });
    }

    window.addEventListener('serlo:live-gift-sent', handleLocalGift);
    return () => window.removeEventListener('serlo:live-gift-sent', handleLocalGift);
  }, [sessionId, spawnBurst]);

  return <LiveGiftAnimationView bursts={bursts} onBurstDone={removeBurst} />;
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

function resolveGiftLottieUrl(giftId?: string | null, remoteUrl?: string | null): string | null {
  if (giftId && LOCAL_GIFT_LOTTIE_URLS[giftId]) return LOCAL_GIFT_LOTTIE_URLS[giftId];
  if (!remoteUrl) return null;

  const trimmed = remoteUrl.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('https://')) return trimmed;
  return null;
}

function resolveGiftVideoUrl(giftId?: string | null, remoteUrl?: string | null): string | null {
  if (remoteUrl) {
    const trimmed = remoteUrl.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('https://')) return trimmed;
  }
  if (!giftId) return null;
  return LOCAL_GIFT_VIDEO_URLS[giftId] ?? null;
}

interface LiveGiftAnimationViewProps {
  bursts: LiveGiftBurst[];
  onBurstDone?: (id: string) => void;
}

export function LiveGiftAnimationView({ bursts, onBurstDone }: LiveGiftAnimationViewProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-hidden="true"
      data-testid="gift-animation-layer"
    >
      {bursts.map((b) => (
        b.giftVideoUrl ? (
          <LivePremiumGiftVideo
            key={b.id}
            burst={b}
            onDone={() => onBurstDone?.(b.id)}
          />
        ) : (
          <LiveGiftFloatingBurst key={b.id} burst={b} />
        )
      ))}
      {/* Keyframes inline. Vermeidet einen tailwind-config-Eingriff für einen so lokalen Effekt. */}
      <style>{`
        @keyframes gift-fly-up {
          0% {
            transform: translate(-50%, 42px) scale(0.46) rotate(-5deg);
            opacity: 0;
            filter: blur(4px);
          }
          12% {
            transform: translate(-50%, 0) scale(1.18) rotate(2deg);
            opacity: 1;
            filter: blur(0);
          }
          28% {
            transform: translate(-50%, -18px) scale(1) rotate(0);
            opacity: 1;
          }
          78% {
            transform: translate(calc(-50% + var(--drift, 0)), -170px) scale(1.06);
            opacity: 0.95;
          }
          100% {
            transform: translate(calc(-50% + var(--drift, 0)), -230px) scale(0.86);
            opacity: 0;
            filter: blur(2px);
          }
        }
        .animate-gift-burst {
          animation: gift-fly-up 5.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity, filter;
        }
        @keyframes gift-aura {
          from {
            transform: scale(0.92);
            opacity: 0.62;
          }
          to {
            transform: scale(1.16);
            opacity: 0.22;
          }
        }
        .animate-gift-aura {
          animation: gift-aura 1.35s ease-out infinite alternate;
        }
        @keyframes gift-sparkle {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(0.72);
            opacity: 0.35;
          }
          45% {
            transform: translate3d(8px, -10px, 0) scale(1.15);
            opacity: 1;
          }
        }
        .gift-sparkle {
          animation: gift-sparkle 1.35s ease-in-out infinite;
        }
        @keyframes premium-gift-enter {
          0% {
            transform: translate3d(0, 48px, 0) scale(0.82);
            opacity: 0;
            filter: blur(10px);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }
        .animate-premium-gift {
          animation: premium-gift-enter 1.25s ease-out both;
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LiveGiftFloatingBurst — normales Geschenk ohne Kartenfenster.
// -----------------------------------------------------------------------------

function LiveGiftFloatingBurst({ burst }: { burst: LiveGiftBurst }) {
  return (
    <div
      className={`absolute bottom-[24%] ${LANE_LEFT[burst.lane]} isolate flex animate-gift-burst flex-col items-center text-center text-white`}
      style={{ ['--drift' as string]: `${burst.drift}px` } as CSSProperties}
      data-testid="gift-burst"
    >
      <span className="animate-gift-aura absolute left-1/2 top-1/2 -z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-300/45 via-white/25 to-pink-400/45 blur-2xl" />
      <span className="gift-sparkle absolute -left-2 -top-2 h-3 w-3 rounded-full bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.9)]" />
      <span className="gift-sparkle absolute -right-1 top-1 h-2.5 w-2.5 rounded-full bg-yellow-200/90 shadow-[0_0_16px_rgba(253,224,71,0.85)] [animation-delay:180ms]" />
      <span className="gift-sparkle absolute bottom-1 right-6 h-2 w-2 rounded-full bg-pink-100/90 shadow-[0_0_14px_rgba(251,207,232,0.9)] [animation-delay:360ms]" />

      {burst.giftLottieUrl ? (
        <LiveGiftLottie src={burst.giftLottieUrl} fallback={burst.giftEmoji ?? '🎁'} />
      ) : burst.giftImage ? (
        // Plain `<img>` bewusst: externe Gift-Assets sind nicht zwingend in
        // `next.config` allowlisted.
        // `live-gifts-feed.tsx` nutzt dasselbe Muster für Konsistenz.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={burst.giftImage}
          alt=""
          className="relative z-10 h-16 w-16 flex-shrink-0 object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.35)]"
        />
      ) : (
        <span className="relative z-10 text-7xl leading-none drop-shadow-[0_12px_22px_rgba(0,0,0,0.48)]" aria-hidden="true">
          {burst.giftEmoji ?? '🎁'}
        </span>
      )}
      <div className="relative z-10 mt-2 flex max-w-52 flex-col leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]">
        <span className="truncate text-sm font-extrabold text-white">
          {burst.senderName}
        </span>
        <span className="truncate text-lg font-black text-white">
          {burst.giftName}
        </span>
        <span className="mt-0.5 truncate text-xs font-bold text-white/95">
          🪙 {burst.coinCost.toLocaleString('de-DE')}
        </span>
      </div>
    </div>
  );
}

function LivePremiumGiftVideo({
  burst,
  onDone,
}: {
  burst: LiveGiftBurst;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = 1;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    }
  }, [burst.giftVideoUrl]);

  return (
    <div
      className="absolute inset-x-0 bottom-[8%] z-40 flex justify-center sm:bottom-[10%]"
      data-testid="premium-gift-stage"
    >
      <video
        ref={videoRef}
        src={burst.giftVideoUrl ?? undefined}
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        className="animate-premium-gift h-[46vh] min-h-[240px] max-h-[560px] w-auto max-w-[96%] object-contain drop-shadow-[0_28px_70px_rgba(0,0,0,0.62)]"
        data-testid="premium-gift-video"
      />
    </div>
  );
}

function LiveGiftLottie({ src, fallback }: { src: string; fallback: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || failed) return;

    let cancelled = false;
    let animation: AnimationItem | null = null;

    async function load() {
      try {
        const lottie = (await import('lottie-web')).default;
        if (cancelled || !containerRef.current) return;

        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: src,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            progressiveLoad: true,
          },
        });
        animation.addEventListener('data_failed', () => setFailed(true));
      } catch (error) {
        console.warn('[LiveGiftAnimationLayer] lottie animation unavailable', error);
        if (!cancelled) setFailed(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [failed, src]);

  if (failed) {
    return (
      <span
        className="relative z-10 text-6xl leading-none drop-shadow-[0_12px_22px_rgba(0,0,0,0.35)]"
        aria-hidden="true"
      >
        {fallback}
      </span>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative z-10 h-24 w-24 flex-shrink-0 drop-shadow-[0_14px_28px_rgba(0,0,0,0.38)]"
    />
  );
}
