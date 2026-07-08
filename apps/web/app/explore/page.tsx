import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { CoinIcon } from '@/components/ui/coin-icon';
import { Hash, Flame, TrendingUp, Compass, Users, ShieldCheck, ShoppingBag, ChevronRight } from 'lucide-react';
import {
  getPublicTrendingHashtags,
  getPublicForYouFeed,
  getDiscoverPeople,
  getPublicDiscoverPeople,
} from '@/lib/data/feed';
import type { DiscoverReason } from '@/lib/data/feed';
import { hasSupabaseAuthCookie } from '@/lib/auth/cookies';
import { getUser, getProfile } from '@/lib/auth/session';
import { getPublicShopPreviewProducts } from '@/lib/data/shop';
import { FollowButton } from '@/components/profile/follow-button';
import { ExplorePostGrid } from '@/components/explore/explore-post-grid';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// /explore — Trending Hashtags + People-Discovery + Popular Posts (∞ scroll).
//
// Sektionen:
//  1. Trending Hashtags
//  2. Accounts entdecken — getSuggestedFollows(12)
//  3. Shop-Strip — top 6 Produkte (v1.w.UI.193, mobile parity)
//  4. Women-Only Zone Banner (v1.w.UI.168)
//  5. Populäre Posts — SSR-Seed 12, infinite scroll via ExplorePostGrid
// -----------------------------------------------------------------------------

export const revalidate = 0; // force-dynamic wegen Auth-abhängiger People-Section

const EXPLORE_SEED = 12;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('explore.metaTitle'),
    description: t('explore.metaDescription'),
  };
}

export default async function ExplorePage() {
  const [hashtags, preview, t, locale] = await Promise.all([
    getPublicTrendingHashtags(24),
    getPublicForYouFeed({ limit: EXPLORE_SEED }),
    getT(),
    getLocale(),
  ]);

  return (
    <main className="container mx-auto max-w-6xl px-4 pb-8 pt-16 sm:pt-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Compass className="h-7 w-7 text-muted-foreground" />
          {t('explore.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('explore.subtitle')}</p>
      </header>

      {/* Trending Hashtags */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5 text-muted-foreground" />
          {t('explore.trendingHashtags')}
        </h2>

        {hashtags.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Hash className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('explore.noTrendsTitle')}</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {t('explore.noTrendsHint')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {hashtags.map((h, idx) => (
              <li key={h.tag}>
                <Link
                  href={`/t/${encodeURIComponent(h.tag)}` as Route}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-sm font-semibold">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      {h.tag}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatCount(h.post_count, locale)} {t('explore.posts')} · {formatCount(h.total_views, locale)} {t('explore.views')}
                    </div>
                  </div>
                  <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:scale-110" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Popular Posts — v1.w.UI.124: ExplorePostGrid mit infinite scroll */}
      {preview.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" />
            {t('explore.popularPosts')}
          </h2>
          <ExplorePostGrid
            initialPosts={preview}
            initialHasMore={preview.length >= EXPLORE_SEED}
          />
        </section>
      )}

      <Suspense fallback={null}>
        <ExploreDeferredSections suggestedPeopleTitle={t('explore.suggestedPeople')} />
      </Suspense>
    </main>
  );
}

async function ExploreDeferredSections({ suggestedPeopleTitle }: { suggestedPeopleTitle: string }) {
  const t = await getT();
  const hasAuthCookie = await hasSupabaseAuthCookie();
  const [topProducts, viewer] = await Promise.all([
    getPublicShopPreviewProducts(6).catch(() => []),
    hasAuthCookie ? getUser() : Promise.resolve(null),
  ]);
  const [people, profile] = await Promise.all([
    viewer ? getDiscoverPeople(12) : getPublicDiscoverPeople(12),
    viewer ? getProfile() : Promise.resolve(null),
  ]);

  const isWozVerified =
    !!(profile as unknown as { gender?: string; women_only_verified?: boolean } | null)
      ?.women_only_verified &&
    (profile as unknown as { gender?: string } | null)?.gender === 'female';

  return (
    <>
      {/* People to follow — v1.w.UI.231: reason labels */}
      {people.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-muted-foreground" />
            {suggestedPeopleTitle}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {people.map((person) => {
              const initial = (person.display_name ?? person.username ?? '?')
                .slice(0, 1)
                .toUpperCase();
              return (
                <li key={person.id}>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center">
                    <Link
                      href={`/u/${person.username}` as Route}
                      className="block shrink-0"
                    >
                      {person.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={person.avatar_url}
                          alt={person.display_name ?? person.username}
                          className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xl font-bold text-muted-foreground ring-2 ring-border">
                          {initial}
                        </div>
                      )}
                    </Link>

                    <div className="w-full min-w-0">
                      <Link href={`/u/${person.username}` as Route} className="block">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {person.display_name ?? person.username}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{person.username}
                        </p>
                      </Link>
                    </div>

                    <DiscoverReasonBadge reason={person.reason} label={t(REASON_KEYS[person.reason])} />

                    <FollowButton
                      isAuthenticated={!!viewer}
                      isFollowing={false}
                      isSelf={false}
                      username={person.username}
                      targetUserId={person.id}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-end">
            <Link
              href="/people"
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Alle ansehen →
            </Link>
          </div>
        </section>
      )}

      {/* v1.w.UI.193 — Shop-Strip: top 6 Produkte (mobile parity) */}
      {topProducts.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              Shop
            </h2>
            <Link
              href={'/shop' as Route}
              className="flex items-center gap-0.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Alle anzeigen
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topProducts.map((product) => (
              <Link
                key={product.id}
                href={`/shop/${product.id}` as Route}
                className="group flex w-32 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.cover_url}
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                  )}
                  {product.sale_price_coins && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-foreground px-1 py-0.5 text-[10px] font-bold text-background">
                      SALE
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <p className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                    {product.title}
                  </p>
                  <p className="text-[11px] font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CoinIcon className="h-3 w-3 text-muted-foreground" />
                      {(product.sale_price_coins ?? product.price_coins).toLocaleString('de-DE')}
                    </span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* v1.w.UI.168 — Women-Only Zone Banner (authenticated users only) */}
      {viewer && (
        <section className="mb-12">
          <Link
            href={'/women-only' as Route}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">
                Women-Only Zone
                {isWozVerified && (
                  <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Mitglied
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {isWozVerified
                  ? t('explore.wozVerifiedHint')
                  : t('explore.wozUnverifiedHint')}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      )}
    </>
  );
}

function formatCount(n: number, locale: Locale): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString(LOCALE_INTL[locale]);
}

// ── Discover Reason Badge (v1.w.UI.231) ────────────────────────────────────────
// Parity mit native discover reasons.
// Labels aus useDiscoverPeople.ts. Kleine Pill unter dem Avatar-Namen.

// Labels via i18n — Badge ist eine synchrone Server-Sub-Komponente, deshalb
// reicht die Page (getT) das aufgelöste Label als Prop durch.
const REASON_KEYS = {
  guild: 'explore.reasonSamePod',
  interests: 'explore.reasonInterests',
  new: 'explore.reasonNew',
} as const;

const REASON_CLASSES: Record<DiscoverReason, string> = {
  guild: 'bg-muted text-muted-foreground',
  interests: 'bg-muted text-muted-foreground',
  new: 'bg-muted text-muted-foreground',
};

function DiscoverReasonBadge({ reason, label }: { reason: DiscoverReason; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${REASON_CLASSES[reason]}`}
    >
      {label}
    </span>
  );
}
