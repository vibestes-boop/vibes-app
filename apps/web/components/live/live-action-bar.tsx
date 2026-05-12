'use client';

import { useEffect, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  BarChart3,
  Check,
  Copy,
  Flag,
  Flame,
  Frown,
  Gift,
  HandMetal,
  Heart,
  Laugh,
  Mail,
  MessageCircle,
  Scissors,
  Send,
  Share2,
  Sparkles,
  Users2,
} from 'lucide-react';
import { sendLiveReaction, requestCoHost, cancelCoHostRequest, createLiveClipMarker } from '@/app/actions/live';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { LiveReactionOverlay } from './live-reaction-overlay';
import { useRemoteReactions } from './use-remote-reactions';
import type { ActiveCoHostSSR, ActiveLivePollSSR } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// LiveActionBar — unter dem Player. Vier Gruppen:
//  • Reactions: 6 Emoji-Buttons, client-side floating-heart animation
//  • Gift-Button: öffnet GiftPicker-Sheet
//  • Poll-Button: nur für Moderatoren/CoHosts (v1.w.UI.99, parity v1.27.4)
//  • CoHost-Button: Request senden oder zurückziehen
// -----------------------------------------------------------------------------

export interface LiveActionBarProps {
  sessionId: string;
  hostId: string;
  hostName: string;
  viewerId: string;
  isHost: boolean;
  cohosts: ActiveCoHostSSR[];
  /** v1.w.UI.99: Mod/CoHost-gated poll-start. Undefined = not a moderator. */
  isModerator?: boolean;
  /** SSR-loaded active poll; kept in sync via LivePollStartSheet.onPollChange. */
  activePoll?: ActiveLivePollSSR | null;
  /** ISO timestamp of session start — used to compute positionSecs for clip markers (v1.w.UI.140). */
  sessionStartedAt?: string | null;
  /** v1.w.UI.185 — wenn false: Gift-Button ausblenden (Host hat Geschenke deaktiviert). */
  allowGifts?: boolean;
}

const REACTIONS = [
  { key: 'heart', label: 'Herz', Icon: Heart, color: 'text-rose-500' },
  { key: 'fire', label: 'Feuer', Icon: Flame, color: 'text-orange-500' },
  { key: 'clap', label: 'Klatschen', Icon: HandMetal, color: 'text-amber-500' },
  { key: 'laugh', label: 'Lachen', Icon: Laugh, color: 'text-yellow-500' },
  { key: 'wow', label: 'Wow', Icon: Sparkles, color: 'text-fuchsia-500' },
  { key: 'sad', label: 'Traurig', Icon: Frown, color: 'text-sky-500' },
] as const;

const LiveGiftPicker = dynamic(
  () => import('./live-gift-picker').then((mod) => mod.LiveGiftPicker),
  { ssr: false },
);

const LivePollStartSheet = dynamic(
  () => import('./live-poll-start-sheet').then((mod) => mod.LivePollStartSheet),
  { ssr: false },
);

type CoHostDecisionPayload = {
  userId?: string;
  user_id?: string;
  guest_id?: string;
};

function coHostDecisionMatchesViewer(payload: unknown, viewerId: string) {
  if (!payload || typeof payload !== 'object') return false;
  const signal = payload as CoHostDecisionPayload;
  return signal.userId === viewerId || signal.user_id === viewerId || signal.guest_id === viewerId;
}

export function LiveActionBar({
  sessionId,
  hostId,
  hostName,
  viewerId,
  isHost,
  cohosts,
  isModerator = false,
  activePoll: initialActivePoll = null,
  sessionStartedAt = null,
  allowGifts = true,
}: LiveActionBarProps) {
  const [giftOpen, setGiftOpen] = useState(false);
  const [pollSheetOpen, setPollSheetOpen] = useState(false);
  const [currentPoll, setCurrentPoll] = useState<ActiveLivePollSSR | null>(initialActivePoll);
  const [coHostRequested, setCoHostRequested] = useState(false);
  const [overlayBurst, setOverlayBurst] = useState<{ key: string; id: number } | null>(null);
  // v1.w.UI.140 — Clip marker: brief "marked!" feedback state (resets after 2 s)
  const [clipMarked, setClipMarked] = useState(false);
  // v1.w.UI.199 — Share button: brief "Kopiert!"-feedback state
  const [shareCopied, setShareCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [, startTransition] = useTransition();
  const router = useRouter();

  // v1.w.UI.19 B6 — Remote Reactions von anderen Viewern. Das `sendLiveReaction`
  // server action broadcastet bereits seit v1.18.0 auf `live:{id}` Event
  // `reaction`, aber niemand subscribed. Heißt: jeder Viewer sah NUR seine
  // eigenen schwebenden Hearts. Mit diesem Hook fliegen jetzt ALLE Reactions
  // aller Viewer über den Screen — TikTok-Party-Feeling.
  //
  // Self-Filter läuft im Hook: payload.user_id === viewerId wird gedroppt
  // weil die lokale Optimistic-Burst bereits den Effekt zeigt (sonst Doppel-
  // Float pro Klick).
  const { burst: remoteBurst } = useRemoteReactions({ sessionId, viewerId });

  const alreadyCoHost = cohosts.some((c) => c.user_id === viewerId);

  useEffect(() => {
    if (!viewerId || isHost || alreadyCoHost) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`co-host-signals-${sessionId}`, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on('broadcast', { event: 'co-host-accepted' }, ({ payload }) => {
        if (!coHostDecisionMatchesViewer(payload, viewerId)) return;
        setCoHostRequested(false);
        window.setTimeout(() => router.refresh(), 80);
      })
      .on('broadcast', { event: 'cohost-reject' }, ({ payload }) => {
        if (!coHostDecisionMatchesViewer(payload, viewerId)) return;
        setCoHostRequested(false);
        window.setTimeout(() => router.refresh(), 80);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alreadyCoHost, isHost, router, sessionId, viewerId]);

  const handleReaction = (key: string) => {
    // Floating-Animation sofort (optimistic, kein await)
    setOverlayBurst({ key, id: Date.now() });
    startTransition(async () => {
      await sendLiveReaction(sessionId, key);
    });
  };

  const handleCoHost = () => {
    if (alreadyCoHost) return;
    startTransition(async () => {
      if (coHostRequested) {
        const result = await cancelCoHostRequest(sessionId);
        if (result.ok) setCoHostRequested(false);
      } else {
        const result = await requestCoHost(sessionId);
        if (result.ok) setCoHostRequested(true);
      }
    });
  };

  // v1.w.UI.199 — Share-Menue: ruhiger Desktop/Mobile Popover statt loser Aktion.
  const openShareMenu = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    setShareUrl(url);
    setShareOpen((open) => !open);
  };

  const copyShareLink = async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing to do silently
    }
  };

  const handleNativeShare = async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!url) return;
    const title = `${hostName} streamt live`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or API unavailable — fall through to clipboard
      }
    }
    await copyShareLink();
  };

  // v1.w.UI.140 — Mark clip: record the current stream position.
  // positionSecs = elapsed time since stream started (best approximation client-side).
  const handleClipMarker = () => {
    const positionSecs = sessionStartedAt
      ? Math.max(0, Math.floor((Date.now() - Date.parse(sessionStartedAt)) / 1000))
      : 0;
    startTransition(async () => {
      const res = await createLiveClipMarker(sessionId, positionSecs);
      if (res.ok) {
        setClipMarked(true);
        setTimeout(() => setClipMarked(false), 2000);
      }
    });
  };

  return (
    <>
      <div className="flex w-full items-center gap-2 overflow-x-auto rounded-xl border bg-card p-2 [scrollbar-width:none] xl:gap-2 xl:rounded-[14px] xl:border-white/10 xl:bg-transparent xl:p-1 [&::-webkit-scrollbar]:hidden">
        {/* Reactions */}
        <div className="flex min-w-max flex-1 items-center gap-1 xl:gap-2">
          {REACTIONS.map(({ key, label, Icon, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleReaction(key)}
              className="group inline-flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors hover:bg-muted xl:h-16 xl:w-[88px] xl:flex-col xl:gap-1 xl:rounded-xl xl:bg-white/10 xl:text-white xl:ring-1 xl:ring-white/10 xl:hover:bg-white/15"
              aria-label={label}
              title={label}
            >
              <Icon className={cn('h-4 w-4 xl:h-5 xl:w-5', color)} aria-hidden="true" />
              <span className="hidden text-[11px] font-medium text-white/80 xl:block">
                {label}
              </span>
            </button>
          ))}
        </div>

        <div className="hidden h-8 w-px flex-none bg-border xl:block xl:h-12 xl:bg-white/15" />

        {/* Share-Button — v1.w.UI.199: Web Share API → clipboard fallback */}
        <button
          type="button"
          onClick={openShareMenu}
          className={cn(
            'inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors xl:h-16 xl:min-w-[86px] xl:flex-col xl:justify-center xl:gap-1 xl:rounded-xl xl:border-white/10 xl:bg-white/10 xl:px-3 xl:text-white xl:hover:bg-white/15',
            shareCopied
              ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'hover:bg-muted',
          )}
          title="Stream-Link teilen"
          aria-label="Stream-Link teilen"
        >
          {shareCopied ? (
            <><Check className="h-4 w-4" /><span>Kopiert</span></>
          ) : (
            <><Share2 className="h-4 w-4" /><span>Teilen</span></>
          )}
        </button>

        <div className="hidden h-8 w-px flex-none bg-border xl:block xl:h-12 xl:bg-white/15" />

        {/* Gift-Button — v1.w.UI.185: nur rendern wenn allowGifts */}
        {allowGifts && (
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 px-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] xl:h-16 xl:min-w-[108px] xl:flex-col xl:justify-center xl:gap-1 xl:rounded-xl xl:px-4"
          >
            <Gift className="h-4 w-4 xl:h-5 xl:w-5" />
            <span>Geschenk</span>
          </button>
        )}

        {/* Poll-Button — nur für Moderatoren / aktive CoHosts (v1.w.UI.99) */}
        {isModerator && (
          <>
            <div className="h-6 w-px bg-border" />
            <button
              type="button"
              onClick={() => setPollSheetOpen(true)}
              title={currentPoll ? 'Aktive Umfrage verwalten' : 'Umfrage starten'}
              aria-label={currentPoll ? 'Aktive Umfrage verwalten' : 'Umfrage starten'}
              className={cn(
                'inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors xl:h-16 xl:min-w-[92px] xl:flex-col xl:justify-center xl:gap-1 xl:rounded-xl xl:border-white/10 xl:bg-white/10 xl:px-3 xl:text-white xl:hover:bg-white/15',
                currentPoll
                  ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                  : 'hover:bg-muted',
              )}
            >
              <BarChart3 className="h-4 w-4" />
              {currentPoll ? 'Umfrage läuft' : 'Umfrage'}
            </button>
          </>
        )}

        {/* CoHost-Button (nur wenn nicht Host und nicht schon CoHost) */}
        {!isHost && !alreadyCoHost && (
          <button
            type="button"
            onClick={handleCoHost}
            className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors xl:h-16 xl:min-w-[96px] xl:flex-col xl:justify-center xl:gap-1 xl:rounded-xl xl:border-white/10 xl:bg-white/10 xl:text-white xl:hover:bg-white/15 ${
              coHostRequested
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'hover:bg-muted'
            }`}
          >
            <Users2 className="h-4 w-4" />
            {coHostRequested ? 'Anfrage gesendet' : 'Zum Duett'}
          </button>
        )}
        {alreadyCoHost && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500 bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400">
            <Users2 className="h-4 w-4" />
            Du bist dabei
          </span>
        )}

        {/* Clip-Marker — v1.w.UI.140. Nur für eingeloggte Viewer (nicht Hosts,
            die sehen die Markers sowieso im Replay). Brief "✓ Markiert!"-Feedback. */}
        {!isHost && (
          <button
            type="button"
            onClick={handleClipMarker}
            disabled={clipMarked}
            className={cn(
              'inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors xl:h-16 xl:min-w-[84px] xl:flex-col xl:justify-center xl:gap-1 xl:rounded-xl xl:border-white/10 xl:bg-white/10 xl:px-3 xl:text-white xl:hover:bg-white/15',
              clipMarked
                ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
                : 'hover:bg-muted',
            )}
            title="Diesen Moment als Clip markieren"
            aria-label="Clip markieren"
          >
            {clipMarked ? (
              <><Check className="h-4 w-4" />Markiert</>
            ) : (
              <><Scissors className="h-4 w-4" />Clip</>
            )}
          </button>
        )}

        <div className="ml-auto hidden shrink-0 text-[11px] text-muted-foreground lg:block xl:hidden">
          Host: <span className="font-medium text-foreground">{hostName}</span>
        </div>
      </div>

      {/* Zwei Overlays (lokal + remote) stapeln sich visuell im gleichen
          unten-rechten Korridor. `LiveReactionOverlay` cappt intern bei
          MAX_ITEMS = 30 — pro Overlay, also gesamt 60 gleichzeitige Floater.
          Das reicht für die 2s-Lebenszeit pro Item (bei 30 Reactions/Sekunde
          würden auch eh nur 60 sichtbar sein). */}
      <LiveReactionOverlay burst={overlayBurst} />
      <LiveReactionOverlay burst={remoteBurst} />

      {shareOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setShareOpen(false)}>
          <div
            className="absolute bottom-24 left-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-zinc-950/94 text-white shadow-elevation-3 ring-1 ring-white/10 backdrop-blur-xl xl:bottom-28"
            role="dialog"
            aria-label="Stream teilen"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-sm font-bold">Stream teilen</p>
              <p className="mt-0.5 truncate text-xs text-white/55">{shareUrl}</p>
            </div>

            <div className="grid grid-cols-4 gap-2 p-3">
              <ShareMenuButton
                icon={<Share2 className="h-5 w-5" aria-hidden="true" />}
                label="System"
                onClick={handleNativeShare}
              />
              <ShareMenuButton
                icon={<Copy className="h-5 w-5" aria-hidden="true" />}
                label={shareCopied ? 'Kopiert' : 'Link'}
                onClick={copyShareLink}
              />
              <ShareMenuLink
                href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
                label="WhatsApp"
              />
              <ShareMenuLink
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`}
                icon={<Send className="h-5 w-5" aria-hidden="true" />}
                label="Telegram"
              />
              <ShareMenuLink
                href={`mailto:?subject=${encodeURIComponent(`${hostName} streamt live`)}&body=${encodeURIComponent(shareUrl)}`}
                icon={<Mail className="h-5 w-5" aria-hidden="true" />}
                label="E-Mail"
              />
              {!isHost && (
                <Link
                  href={`/live/${sessionId}/report` as Route}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-white/8 px-2 py-2 text-center text-xs font-medium text-white/80 transition-colors hover:bg-white/12 hover:text-white"
                  onClick={() => setShareOpen(false)}
                >
                  <Flag className="h-5 w-5" aria-hidden="true" />
                  Melden
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {giftOpen && (
        <LiveGiftPicker
          sessionId={sessionId}
          hostId={hostId}
          hostName={hostName}
          cohosts={cohosts}
          onClose={() => setGiftOpen(false)}
        />
      )}

      {/* Poll-Sheet — nur für Moderatoren/CoHosts */}
      {pollSheetOpen && (
        <LivePollStartSheet
          sessionId={sessionId}
          activePoll={currentPoll}
          onClose={() => setPollSheetOpen(false)}
          onPollChange={(p) => {
            setCurrentPoll(p);
            if (!p) setPollSheetOpen(false);
          }}
        />
      )}
    </>
  );
}

function ShareMenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-white/8 px-2 py-2 text-center text-xs font-medium text-white/80 transition-colors hover:bg-white/12 hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}

function ShareMenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-white/8 px-2 py-2 text-center text-xs font-medium text-white/80 transition-colors hover:bg-white/12 hover:text-white"
    >
      {icon}
      {label}
    </a>
  );
}
