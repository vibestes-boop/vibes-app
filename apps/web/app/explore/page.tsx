import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Hash, Flame, TrendingUp, Compass } from 'lucide-react';
import { getTrendingHashtags, getForYouFeed } from '@/lib/data/feed';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// /explore — Trending Hashtags + horizontaler Preview-Strip.
// SSR mit Revalidate (Trending ändert sich nicht pro Request, aber stündlich).
// -----------------------------------------------------------------------------

export const revalidate = 900; // 15 min

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('explore.metaTitle'),
    description: t('explore.metaDescription'),
  };
}

export default async function ExplorePage() {
  const [hashtags, preview, t, locale] = await Promise.all([
    getTrendingHashtags(24),
    getForYouFeed({ limit: 6 }),
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

      {/* Video-Preview */}
      {preview.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" />
            {t('explore.popularPosts')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {preview.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}` as Route}
                  className="group relative block aspect-[9/16] overflow-hidden rounded-lg bg-black"
                >
                  {p.thumbnail_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.thumbnail_url}
                      alt={p.caption ?? 'Post'}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 text-xs text-white">
                    <div className="truncate font-medium">@{p.author.username}</div>
                    <div className="text-white/70">
                      {formatCount(p.view_count ?? 0, locale)} {t('explore.views')}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
