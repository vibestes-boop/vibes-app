import { createClient } from '@/lib/supabase/server';
import { LandingPage, type FeaturedCreator } from '@/components/landing-page';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import { StoryStrip } from '@/components/feed/story-strip';
import {
  getForYouFeed,
  getFollowingFeed,
  getMyFollowedAccounts,
  getSuggestedFollows,
  getTrendingHashtags,
} from '@/lib/data/feed';
import { getActiveLiveSessions } from '@/lib/data/live';

/**
 * `/` Home-Route.
 *
 * - Logged-out: Landing-Page (Hero, Value-Props, Discovery-Strip).
 * - Logged-in:  HomeFeedShell (For-You/Following Tabs, Sidebars, Vertical-Feed).
 *
 * Kein `revalidate`, weil auth-basiert — aber die einzelnen Server-Component-Reads
 * sind via `cache()` pro Request memoized und Supabase-RLS erledigt das Scoping.
 */

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const [featured, liveNow, trendingPosts] = await Promise.all([
      getFeaturedCreators(),
      getActiveLiveSessions(4).catch(() => []),
      getForYouFeed({ limit: 6 }).catch(() => []),
    ]);
    // ── JSON-LD: WebSite + SearchAction ─────────────────────────────────────
    // Enables Google Sitelinks Searchbox in search results. Only on the public
    // landing page — logged-in feed is personalised so WebSite schema is not
    // meaningful there. SearchAction points to /search?q={search_term_string}.
    // v1.w.UI.135
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://serlo.app';
    const websiteJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Serlo',
      url: siteUrl,
      description: 'Deine Community — Videos, Live, Geschenke, Shop.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <LandingPage featured={featured} liveNow={liveNow} trendingPosts={trendingPosts} />
      </>
    );
  }

  // Logged-in: Feed-Shell mit SSR-Prefetch.
  // For-You ist Initial-Load (fast & wichtig für LCP).
  // Following wird optional eagerly geladen wenn User folgt, sonst null (lazy).
  // FollowedAccounts wird für die Sidebar-Section („Konten, denen ich folge")
  // immer mitgefetcht (v1.w.UI.11 Phase B) — gibt bei Empty-Follows leeres
  // Array zurück und die Sektion rendert einen Explore-CTA.
  const [forYou, suggested, followedAccounts, trendingHashtags, hasFollows] = await Promise.all([
    getForYouFeed({ limit: 10 }),
    getSuggestedFollows(5),
    getMyFollowedAccounts({ limit: 5 }),
    getTrendingHashtags(6),
    (async () => {
      const { count } = await supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('follower_id', user.id);
      return (count ?? 0) > 0;
    })(),
  ]);

  // Nur wenn der User jemandem folgt, prefetchen wir — sonst sparen wir den Call.
  const following = hasFollows ? await getFollowingFeed({ limit: 10 }) : null;

  return (
    <HomeFeedShell
      viewerId={user.id}
      initialForYou={forYou}
      initialFollowing={following}
      suggested={suggested}
      followedAccounts={followedAccounts}
      trendingHashtags={trendingHashtags}
      storyStripSlot={<StoryStrip />}
    />
  );
}

// -----------------------------------------------------------------------------
// Landing-Discovery: Top-Creator nach Follower-Count. Fehler schlucken.
// -----------------------------------------------------------------------------

async function getFeaturedCreators(): Promise<FeaturedCreator[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, follower_count')
      .order('follower_count', { ascending: false })
      .limit(6);
    return (data as FeaturedCreator[] | null) ?? [];
  } catch {
    return [];
  }
}
