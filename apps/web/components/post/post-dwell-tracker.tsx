'use client';

import { useEffect, useRef } from 'react';
import { recordDwell } from '@/app/actions/engagement';

// -----------------------------------------------------------------------------
// PostDwellTracker — v1.w.UI.53.
//
// Fire-and-forget Client-Wrapper der `recordDwell` auf Mount aufruft.
// Nur für eingeloggte User (isAuthenticated Guard).
//
// Post-Detail-Besuche zählen sofort mit 5000ms (5s) als Dwell-Signal —
// der User hat aktiv auf den Post navigiert, das ist stärker als passives
// Feed-Scrollen. Das RPC hat serverseitig einen 60min-Cooldown + max 5/Post/User.
// -----------------------------------------------------------------------------

export function PostDwellTracker({
  postId,
  isAuthenticated,
}: {
  postId: string;
  isAuthenticated: boolean;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || fired.current) return;
    fired.current = true;
    void recordDwell(postId, 5000);
  }, [postId, isAuthenticated]);

  return null;
}
