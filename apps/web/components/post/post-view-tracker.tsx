'use client';

// -----------------------------------------------------------------------------
// PostViewTracker — fires increment_post_view once on mount for /p/[postId].
//
// v1.w.UI.138: The web app was never incrementing post view counts, while the
// mobile app calls supabase.rpc('increment_post_view') when a post enters view.
// The RPC is SECURITY DEFINER + dedup-guarded (one view per user per post per
// day via post_views table) — safe to fire unconditionally from the client.
//
// Auth: the RPC itself gates on auth.uid() IS NOT NULL via REVOKE FROM anon.
// If the user isn't logged in, Supabase will reject the call silently.
// We suppress all errors — view tracking is never worth breaking the page for.
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface PostViewTrackerProps {
  postId: string;
}

export function PostViewTracker({ postId }: PostViewTrackerProps) {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    // Fire-and-forget. RPC handles dedup + auth guard.
    // Wrap in Promise.resolve() because PostgrestFilterBuilder is thenable but
    // not a native Promise and therefore doesn't expose .catch() directly.
    void Promise.resolve(supabase.rpc('increment_post_view', { p_post_id: postId })).catch(() => undefined);
  // Only run once on mount — postId is stable for the lifetime of this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
