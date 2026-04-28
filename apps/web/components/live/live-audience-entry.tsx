'use client';

// -----------------------------------------------------------------------------
// <LiveAudienceEntry /> — v1.w.UI.195 (thin client wrapper)
//
// Holds the open-state for LiveAudienceModal + passes onClick to LiveViewerCount.
// Mounted by the RSC live viewer page, receives all props from the server.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { LiveViewerCount } from './live-viewer-count';
import { LiveAudienceModal } from './live-audience-modal';

export interface LiveAudienceEntryProps {
  sessionId: string;
  initialCount: number;
  hostId: string;
  viewerId: string | null;
  isHost: boolean;
}

export function LiveAudienceEntry({
  sessionId,
  initialCount,
  hostId,
  viewerId,
  isHost,
}: LiveAudienceEntryProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <LiveViewerCount
        sessionId={sessionId}
        initialCount={initialCount}
        onClick={() => setOpen(true)}
      />
      <LiveAudienceModal
        open={open}
        onClose={() => setOpen(false)}
        sessionId={sessionId}
        hostId={hostId}
        viewerId={viewerId}
        isHost={isHost}
      />
    </>
  );
}
