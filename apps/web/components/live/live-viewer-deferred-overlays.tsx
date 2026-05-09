'use client';

import dynamic from 'next/dynamic';

import type { ActiveLivePollSSR } from '@/lib/data/live';
import type { ActiveGiftGoal } from '@/lib/data/live-host';

const LiveActivePollWatcher = dynamic(
  () => import('./live-active-poll-watcher').then((mod) => mod.LiveActivePollWatcher),
  { ssr: false },
);

const LiveBattleOverlay = dynamic(
  () => import('./live-battle-overlay').then((mod) => mod.LiveBattleOverlay),
  { ssr: false },
);

const LiveDuetInviteWatcher = dynamic(
  () => import('./live-duet-invite-watcher').then((mod) => mod.LiveDuetInviteWatcher),
  { ssr: false },
);

const LiveGiftAnimationLayer = dynamic(
  () => import('./live-gift-animation-layer').then((mod) => mod.LiveGiftAnimationLayer),
  { ssr: false },
);

const LiveGiftGoalViewer = dynamic(
  () => import('./live-gift-goal-viewer').then((mod) => mod.LiveGiftGoalViewer),
  { ssr: false },
);

const LiveGiftLeaderboard = dynamic(
  () => import('./live-gift-leaderboard').then((mod) => mod.LiveGiftLeaderboard),
  { ssr: false },
);

const LiveHostShopBadge = dynamic(
  () => import('./live-host-shop-sheet').then((mod) => mod.LiveHostShopBadge),
  { ssr: false },
);

const LivePlacedProductLayer = dynamic(
  () => import('./live-placed-product-layer').then((mod) => mod.LivePlacedProductLayer),
  { ssr: false },
);

const LiveShoppingViewer = dynamic(
  () => import('./live-shopping-viewer').then((mod) => mod.LiveShoppingViewer),
  { ssr: false },
);

const LiveStickerLayer = dynamic(
  () => import('./live-sticker-layer').then((mod) => mod.LiveStickerLayer),
  { ssr: false },
);

const LiveWelcomeToasts = dynamic(
  () => import('./live-welcome-toasts').then((mod) => mod.LiveWelcomeToasts),
  { ssr: false },
);

interface LiveViewerStageDeferredOverlaysProps {
  sessionId: string;
  viewerId: string | null;
  isHost: boolean;
  ended: boolean;
  activePoll: ActiveLivePollSSR | null;
  activeGiftGoal: ActiveGiftGoal | null;
  shopEnabled: boolean;
  hostId: string;
  hostUsername: string | null;
  hostShopCount: number;
  hostName: string;
  coHostName: string | null;
  coHostId: string | null;
  viewerUsername: string | null;
}

export function LiveViewerStageDeferredOverlays({
  sessionId,
  viewerId,
  isHost,
  ended,
  activePoll,
  activeGiftGoal,
  shopEnabled,
  hostId,
  hostUsername,
  hostShopCount,
  hostName,
  coHostName,
  coHostId,
  viewerUsername,
}: LiveViewerStageDeferredOverlaysProps) {
  if (ended) {
    return null;
  }

  return (
    <>
      <LiveGiftAnimationLayer sessionId={sessionId} />
      <LiveStickerLayer sessionId={sessionId} />
      <LivePlacedProductLayer sessionId={sessionId} />
      <LiveActivePollWatcher
        sessionId={sessionId}
        initialPoll={activePoll}
        viewerId={viewerId}
        ended={ended}
      />

      <div className="absolute bottom-20 right-3 z-10 flex flex-col items-end gap-2">
        {shopEnabled && hostUsername && (
          <LiveHostShopBadge
            hostId={hostId}
            hostUsername={hostUsername}
            productCount={hostShopCount}
          />
        )}
        <LiveGiftGoalViewer sessionId={sessionId} initialGoal={activeGiftGoal} />
      </div>

      <LiveBattleOverlay
        sessionId={sessionId}
        hostName={hostName}
        coHostName={coHostName}
        coHostId={coHostId}
      />
      <LiveShoppingViewer sessionId={sessionId} viewerUsername={viewerUsername} />
      {viewerId && !isHost && <LiveDuetInviteWatcher sessionId={sessionId} viewerId={viewerId} />}
    </>
  );
}

export function LiveViewerDeferredWelcomeToasts({
  sessionId,
  viewerId,
}: {
  sessionId: string;
  viewerId: string;
}) {
  return <LiveWelcomeToasts sessionId={sessionId} viewerId={viewerId} />;
}

export function LiveViewerDeferredGiftLeaderboard({ sessionId }: { sessionId: string }) {
  return <LiveGiftLeaderboard sessionId={sessionId} />;
}
