import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Following-Feed — Serlo',
  robots: { index: false, follow: false },
};

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import {
  getForYouFeed,
  getFollowingFeed,
  getMyFollowedAccounts,
  getSuggestedFollows,
  getTrendingHashtags,
} from '@/lib/data/feed';

/**
 * `/following` — dedizierte Route für den Following-Feed.
 *
 * Historisch hat die linke Sidebar (`components/feed/feed-sidebar.tsx`) auf
 * `/following` gelinked, aber die Route existierte nicht → 404. Der eigentliche
 * Following-Tab lebt im `HomeFeedShell` auf `/`; diese Page reused den gleichen
 * Shell und übergibt `initialTab="following"` damit Deep-Links + Sidebar-Klick
 * direkt im richtigen Tab landen.
 *
 * Logged-out → Redirect zur Landing (`/`). Kein eigener Unauth-State.
 */

export const dynamic = 'force-dynamic';

export default async function FollowingFeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // Gleiches Prefetch-Muster wie `/`:
  // - For-You wird geprefetcht, damit der Tab-Switch keine Ladeverzögerung hat.
  // - Following ist hier der Primär-Tab → eager laden.
  // - FollowedAccounts für die Sidebar-Section (v1.w.UI.11 Phase B).
  const [forYou, following, suggested, followedAccounts, trendingHashtags, viewerIsAdmin] = await Promise.all([
    getForYouFeed({ limit: 10 }),
    getFollowingFeed({ limit: 10 }),
    getSuggestedFollows(5),
    getMyFollowedAccounts({ limit: 5 }),
    getTrendingHashtags(6),
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
    })(),
  ]);

  return (
    <HomeFeedShell
      viewerId={user.id}
      initialForYou={forYou}
      initialFollowing={following}
      suggested={suggested}
      followedAccounts={followedAccounts}
      trendingHashtags={trendingHashtags}
      viewerIsAdmin={viewerIsAdmin}
      initialTab="following"
    />
  );
}
