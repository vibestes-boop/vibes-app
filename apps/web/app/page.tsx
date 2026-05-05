import { createClient } from '@/lib/supabase/server';
import { LandingPage } from '@/components/landing-page';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import { getUser } from '@/lib/auth/session';
import {
  getForYouFeed,
  getPublicForYouFeed,
  getMyFollowedAccounts,
  getSuggestedFollows,
} from '@/lib/data/feed';
import { getCachedActiveLiveSessions } from '@/lib/data/live';
import {
  FEED_VIDEO_POSTER_WIDTH,
  getOptimizedImageUrl,
} from '@/lib/media/optimized-image-url';

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
  const user = await getUser();

  if (!user) {
    const [liveNow, trendingPosts] = await Promise.all([
      getCachedActiveLiveSessions(4).catch(() => []),
      getPublicForYouFeed({ limit: 6 }).catch(() => []),
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
        <LandingPage featured={[]} liveNow={liveNow} trendingPosts={trendingPosts} />
      </>
    );
  }

  const supabase = await createClient();

  // Logged-in: Feed-Shell mit schlankem SSR-Prefetch.
  // For-You ist der sichtbare Initial-Load und bleibt deshalb im kritischen Pfad.
  // Following/Stories/Trending werden nicht auf `/` vorgerendert: sie sind im
  // ersten "Für dich"-Viewport unsichtbar und haben vorher den Cold-Start mit
  // zusätzlichen Supabase-Roundtrips verlängert.
  const [
    forYou,
    suggested,
    followedAccounts,
    viewerIsAdmin,
  ] = await Promise.all([
    getForYouFeed({ limit: 6 }),
    getSuggestedFollows(5),
    getMyFollowedAccounts({ limit: 5 }),
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
    })(),
  ]);

  const firstForYouPost = forYou[0];
  const firstForYouPosterUrl =
    firstForYouPost?.media_type === 'video'
      ? getOptimizedImageUrl(firstForYouPost.thumbnail_url, FEED_VIDEO_POSTER_WIDTH)
      : undefined;

  return (
    <>
      {firstForYouPosterUrl && (
        <link
          rel="preload"
          as="image"
          href={firstForYouPosterUrl}
          fetchPriority="high"
        />
      )}
      <HomeFeedShell
        viewerId={user.id}
        initialForYou={forYou}
        initialFollowing={null}
        suggested={suggested}
        followedAccounts={followedAccounts}
        viewerIsAdmin={viewerIsAdmin}
      />
    </>
  );
}
