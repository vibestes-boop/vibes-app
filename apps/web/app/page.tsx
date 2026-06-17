import { createClient } from '@/lib/supabase/server';
import { LandingPage } from '@/components/landing-page';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import { hasSupabaseAuthCookie } from '@/lib/auth/cookies';
import { getUser } from '@/lib/auth/session';
import {
  getPublicForYouFeed,
  getMyFollowedAccounts,
  getSuggestedFollows,
} from '@/lib/data/feed';
import { getCachedActiveLiveSessions } from '@/lib/data/live';

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

  // Logged-in: Feed-Shell SOFORT rendern. Der For-You-Feed wird NICHT mehr
  // server-seitig abgewartet — das war der Haupt-Blocker: bei kaltem Function-
  // Start + DB-Query blieb die ganze Seite (auch Buttons + Sidebar) sekundenlang
  // im Skelett. Die Shell holt den Feed jetzt client-seitig (initialForYou={null})
  // und zeigt solange nur in der Feed-Fläche ein Skelett. Nur die schlanken
  // Sidebar-/Profil-Daten bleiben SSR (bounded via withTimeout, ~300ms).
  const [suggested, followedAccounts, profileRow] = await Promise.all([
    withTimeout(getSuggestedFollows(5), []),
    withTimeout(getMyFollowedAccounts({ limit: 5 }), []),
    withTimeout(
      (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, is_admin')
          .eq('id', user.id)
          .maybeSingle();
        return data as { username: string | null; display_name: string | null; avatar_url: string | null; is_admin?: boolean } | null;
      })(),
      null,
    ),
  ]);
  const viewerIsAdmin = Boolean(profileRow?.is_admin);
  const viewerProfile = profileRow ? { username: profileRow.username, display_name: profileRow.display_name, avatar_url: profileRow.avatar_url } : null;

  return (
    <HomeFeedShell
      viewerId={user.id}
      initialForYou={null}
      initialFollowing={null}
      suggested={suggested}
      followedAccounts={followedAccounts}
      viewerIsAdmin={viewerIsAdmin}
      viewerProfile={viewerProfile}
    />
  );
}
