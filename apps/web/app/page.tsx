import { createClient } from '@/lib/supabase/server';
import { safeJsonLd } from '@/lib/seo/json-ld';
import { LandingV13 } from '@/components/landing-v13/Landing';
import { getLocale } from '@/lib/i18n/server';
import { HomeFeedShell } from '@/components/feed/home-feed-shell';
import {
  getMyFollowedAccounts,
  getSuggestedFollows,
} from '@/lib/data/feed';

/**
 * `/` Home-Route.
 *
 * - Logged-out: Landing V13 (components/landing-v13, Bildkranz, Funktionen, Sprachen).
 * - Logged-in:  HomeFeedShell (For-You/Following Tabs, Sidebars, Vertical-Feed).
 *
 * Kein `revalidate`, weil auth-basiert — aber die einzelnen Server-Component-Reads
 * sind via `cache()` pro Request memoized und Supabase-RLS erledigt das Scoping.
 */

export const dynamic = 'force-dynamic';

const HOME_SIDEBAR_TIMEOUT_MS = 300;

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
  // Auth NICHT über getUser(): das validiert bei JEDEM Load gegen Supabase übers
  // Netz (ohne Middleware-Refresh hier) → Haupt-Bremser + Rate-Limit-Auslöser bei
  // schnellen Reloads. getSession() liest die Session aus dem Cookie — kein
  // Netzwerk bei gültigem Token. viewerId dient nur dem UI-Rendering; die echte
  // Security erzwingt RLS server-seitig bei jeder Mutation/Query. (Bei
  // abgelaufenem Token refresht getSession einmalig.)
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;

  if (!userId) {
    // Landing V13 (aus apps/heritage-preview): reine Marketing-Seite ohne
    // Datenbank-Abfragen. Sprache folgt dem Locale der Web-App; Tschetschenisch
    // fällt wie überall auf Russisch zurück.
    const locale = await getLocale();
    const landingLang = locale === 'ru' || locale === 'ce' ? 'ru' : locale === 'en' ? 'en' : 'de';
    // ── JSON-LD: WebSite + SearchAction ─────────────────────────────────────
    // Enables Google Sitelinks Searchbox in search results. Only on the public
    // landing page — logged-in feed is personalised so WebSite schema is not
    // meaningful there. SearchAction points to /search?q={search_term_string}.
    // v1.w.UI.135
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.serlo.ch';
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
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
        />
        <LandingV13 lang={landingLang} />
      </>
    );
  }

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
          .eq('id', userId)
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
      viewerId={userId}
      initialForYou={null}
      initialFollowing={null}
      suggested={suggested}
      followedAccounts={followedAccounts}
      viewerIsAdmin={viewerIsAdmin}
      viewerProfile={viewerProfile}
    />
  );
}
