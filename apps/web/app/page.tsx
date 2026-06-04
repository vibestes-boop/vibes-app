import { createClient } from '@/lib/supabase/server';
import { LandingPage } from '@/components/landing-page';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import { hasSupabaseAuthCookie } from '@/lib/auth/cookies';
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

const HOME_SIDEBAR_TIMEOUT_MS = 300;
const HOME_PUBLIC_DYNAMIC_TIMEOUT_MS = 250;

async function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = HOME_SIDEBAR_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const safePromise = promise.catch(() => fallback);

  try {
    return await Promise.race([
      safePromise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default async function HomePage() {
  const hasAuthCookie = await hasSupabaseAuthCookie();
  const user = hasAuthCookie ? await getUser() : null;

  if (!user) {
    const [liveNow, trendingPosts] = await Promise.all([
      withTimeout(getCachedActiveLiveSessions(4), [], HOME_PUBLIC_DYNAMIC_TIMEOUT_MS),
      withTimeout(getPublicForYouFeed({ limit: 6 }), [], HOME_PUBLIC_DYNAMIC_TIMEOUT_MS),
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
  const forYouPromise = getForYouFeed({ limit: 6 });
  const sidebarPromise = Promise.all([
    withTimeout(getSuggestedFollows(5), []),
    withTimeout(getMyFollowedAccounts({ limit: 5 }), []),
    withTimeout(
      (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
      })(),
      false,
    ),
  ]);

  const forYou = await forYouPromise;
  const [suggested, followedAccounts, viewerIsAdmin] = await sidebarPromise;

  const firstForYouPost = forYou[0];
  const firstForYouMediaPreloadUrl =
    firstForYouPost?.media_type === 'video'
      ? getOptimizedImageUrl(firstForYouPost.thumbnail_url, FEED_VIDEO_POSTER_WIDTH)
      : firstForYouPost?.media_type === 'image'
        ? getOptimizedImageUrl(
            firstForYouPost.thumbnail_url || firstForYouPost.video_url,
            FEED_VIDEO_POSTER_WIDTH,
          )
      : undefined;

  return (
    <>
      {firstForYouMediaPreloadUrl && (
        <link
          rel="preload"
          as="image"
          href={firstForYouMediaPreloadUrl}
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
