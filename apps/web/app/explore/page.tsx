import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Hash, Flame, TrendingUp, Compass, Users } from 'lucide-react';
import { getTrendingHashtags, getForYouFeed, getSuggestedFollows } from '@/lib/data/feed';
import { getUser } from '@/lib/auth/session';
import { FollowButton } from '@/components/profile/follow-button';
import { ExplorePostGrid } from '@/components/explore/explore-post-grid';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// /explore — Trending Hashtags + People-Discovery + Popular Posts (∞ scroll).
//
// Drei Sektionen:
//  1. Trending Hashtags
//  2. Accounts entdecken — getSuggestedFollows(12)
//  3. Populäre Posts — SSR-Seed 12, infinite scroll via ExplorePostGrid
//     (GET /api/feed/explore?offset=N). v1.w.UI.124.
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
  const [hashtags, preview, people, viewer, t, locale] = await Promise.all([
    getTrendingHashtags(24),
    getForYouFeed({ limit: EXPLORE_SEED }),
    getSuggestedFollows(12),
    getUser(),
    getT(),
    getLocale(),
  ]);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Compass className="h-7 w-7 text-brand-gold" />
          {t('explore.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('explore.subtitle')}</p>
      </header>

      {/* Trending Hashtags */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5 text-brand-danger" />
          {t('explore.trendingHashtags')}
        </h2>

        {hashtags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('explore.noHashtags')}</p>
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

      {/* People to follow */}
      {people.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-brand-gold" />
            {t('explore.suggestedPeople')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {people.map((person) => {
              const initial = (person.display_name ?? person.username ?? '?')
                .slice(0, 1)
                .toUpperCase();
              return (
                <li key={person.id}>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center">
                    {/* Avatar */}
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

                    {/* Name */}
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

                    {/* Follow button — getSuggestedFollows filters already-followed
                        accounts + self, so isFollowing=false / isSelf=false always. */}
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
          {/* v1.w.UI.120 — Link to full people-discovery page */}
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

      {/* Popular Posts — v1.w.UI.124: ExplorePostGrid mit infinite scroll */}
      {preview.length > 0 && (
        <section>
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
    </main>
  );
}

function formatCount(n: number, locale: Locale): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString(LOCALE_INTL[locale]);
}
