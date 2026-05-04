'use client';

// -----------------------------------------------------------------------------
// PostViewTracker — fires increment_post_view once on mount for /p/[postId].
//
// v1.w.UI.138: The web app was never incrementing post view counts, while the
// mobile app calls increment_post_view when a post enters view. The RPC is
// SECURITY DEFINER + dedup-guarded (one view per user per post per day via
// post_views table) — safe to fire through the server action.
//
// Auth: recordPostView reads the current server session and no-ops for anon.
// We suppress all errors — view tracking is never worth breaking the page.
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { recordPostView } from '@/app/actions/engagement';

interface PostViewTrackerProps {
  postId: string;
}

export function PostViewTracker({ postId }: PostViewTrackerProps) {
  useEffect(() => {
    void recordPostView(postId).catch(() => undefined);
  // Only run once on mount — postId is stable for the lifetime of this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
