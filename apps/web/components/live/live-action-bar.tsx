'use client';

import { useState, useTransition } from 'react';
import { Heart, Flame, Gift, Users2, Laugh, Sparkles, Frown, HandMetal } from 'lucide-react';
import { sendLiveReaction, requestCoHost, cancelCoHostRequest } from '@/app/actions/live';
import { LiveGiftPicker } from './live-gift-picker';
import { LiveReactionOverlay } from './live-reaction-overlay';
import type { ActiveCoHostSSR } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// LiveActionBar — unter dem Player. Drei Gruppen:
//  • Reactions: 6 Emoji-Buttons, client-side floating-heart animation
//  • Gift-Button: öffnet GiftPicker-Sheet
//  • CoHost-Button: Request senden oder zurückziehen
// -----------------------------------------------------------------------------

export interface LiveActionBarProps {
  sessionId: string;
  hostId: string;
  hostName: string;
  viewerId: string;
  isHost: boolean;
  cohosts: ActiveCoHostSSR[];
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
}: LiveActionBarProps) {
  const [giftOpen, setGiftOpen] = useState(false);
  const [coHostRequested, setCoHostRequested] = useState(false);
  const [overlayBurst, setOverlayBurst] = useState<{ key: string; id: number } | null>(null);
  const [, startTransition] = useTransition();

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

        {/* Gift-Button */}
        <button
          type="button"
          onClick={() => setGiftOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105"
        >
          <Gift className="h-4 w-4" />
          Geschenk
        </button>

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

        <div className="ml-auto text-[11px] text-muted-foreground">
          Host: <span className="font-medium text-foreground">{hostName}</span>
        </div>
      </div>

      <LiveReactionOverlay burst={overlayBurst} />

      {giftOpen && (
        <LiveGiftPicker
          sessionId={sessionId}
          hostId={hostId}
          hostName={hostName}
          cohosts={cohosts}
          onClose={() => setGiftOpen(false)}
        />
      )}
    </>
  );
}
