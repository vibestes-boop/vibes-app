'use client';

import { useState, useTransition } from 'react';
import { Heart, Flame, Gift, Users2, Laugh, Sparkles, Frown, HandMetal, BarChart3, Scissors, Check, Share2 } from 'lucide-react';
import { sendLiveReaction, requestCoHost, cancelCoHostRequest, createLiveClipMarker } from '@/app/actions/live';
import { LiveGiftPicker } from './live-gift-picker';
import { LiveReactionOverlay } from './live-reaction-overlay';
import { LivePollStartSheet } from './live-poll-start-sheet';
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
  const [, startTransition] = useTransition();

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

  // v1.w.UI.199 — Share: Web Share API → clipboard fallback
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = `${hostName} streamt live`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or API unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing to do silently
    }
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
        {/* Reactions */}
        <div className="flex items-center gap-1">
          {REACTIONS.map(({ key, label, Icon, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleReaction(key)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted ${color}`}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Share-Button — v1.w.UI.199: Web Share API → clipboard fallback */}
        <button
          type="button"
          onClick={handleShare}
          className={[
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
            shareCopied
              ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'hover:bg-muted',
          ].join(' ')}
          title="Stream-Link teilen"
          aria-label="Stream-Link teilen"
        >
          {shareCopied ? (
            <><Check className="h-4 w-4" />Kopiert!</>
          ) : (
            <><Share2 className="h-4 w-4" />Teilen</>
          )}
        </button>

        <div className="h-6 w-px bg-border" />

        {/* Gift-Button — v1.w.UI.185: nur rendern wenn allowGifts */}
        {allowGifts && (
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105"
          >
            <Gift className="h-4 w-4" />
            Geschenk
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
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                currentPoll
                  ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                  : 'hover:bg-muted',
              ].join(' ')}
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
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
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              clipMarked
                ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
                : 'hover:bg-muted',
            ].join(' ')}
            title="Diesen Moment als Clip markieren"
            aria-label="Clip markieren"
          >
            {clipMarked ? (
              <><Check className="h-4 w-4" />Markiert!</>
            ) : (
              <><Scissors className="h-4 w-4" />Clip</>
            )}
          </button>
        )}

        <div className="ml-auto text-[11px] text-muted-foreground">
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
