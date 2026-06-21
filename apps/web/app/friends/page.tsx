import type { Route } from 'next';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Freunde-Feed — Serlo',
  robots: { index: false, follow: false },
};

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import {
  getFriendsFeed,
  getMyFollowedAccounts,
  getSuggestedFollows,
  getTrendingHashtags,
} from '@/lib/data/feed';

/**
 * `/friends` — dedizierte Route für den „Freunde"-Feed (gegenseitige Follows,
 * Short-Video-Modell). Reused denselben `HomeFeedShell` wie `/` und `/following`
 * und übergibt `initialTab="friends"`, damit Sidebar-Klick + Deep-Link direkt
 * im Freunde-Tab landen.
 *
 * Unterschied zu /following: dort werden ALLE Accounts gezeigt, denen ich folge
 * (einseitig). Hier nur die, die mir AUCH zurückfolgen (mutual = „Freunde").
 *
 * Logged-out → Redirect zur Landing (`/`). Kein eigener Unauth-State.
 */

export const dynamic = 'force-dynamic';

export default async function FriendsFeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/' as Route);
  }

  // Freunde ist hier der Primär-Tab → eager (SSR). For-You ist nicht aktiv →
  // client-seitig nachladen (initialForYou={null}), kein SSR-Block dafür.
  const [friends, suggested, followedAccounts, trendingHashtags, profileRow] = await Promise.all([
    getFriendsFeed({ limit: 10 }),
    getSuggestedFollows(5),
    getMyFollowedAccounts({ limit: 5 }),
    getTrendingHashtags(6),
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      return data as { username: string | null; display_name: string | null; avatar_url: string | null; is_admin?: boolean } | null;
    })(),
  ]);
  const viewerIsAdmin = Boolean(profileRow?.is_admin);
  const viewerProfile = profileRow ? { username: profileRow.username, display_name: profileRow.display_name, avatar_url: profileRow.avatar_url } : null;

  return (
    <HomeFeedShell
      viewerId={user.id}
      initialForYou={null}
      initialFollowing={null}
      initialFriends={friends}
      suggested={suggested}
      followedAccounts={followedAccounts}
      trendingHashtags={trendingHashtags}
      viewerIsAdmin={viewerIsAdmin}
      viewerProfile={viewerProfile}
      initialTab="friends"
    />
  );
}
