import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { Hash, TrendingUp, Eye, Film } from 'lucide-react';
import { getPostsByTag, getTrendingHashtags } from '@/lib/data/feed';
import { getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// /t/[tag] — Hashtag-Detail-Seite (v1.w.UI.41)
//
// Zeigt alle öffentlichen Posts mit dem gegebenen Hashtag, sortiert nach
// View-Count (populärste zuerst). Explore verlinkt hierher — bisher 404.
//
// SEO: generateMetadata mit og:title/description für jeden Hashtag.
// ISR 15 min: Trending-Tags ändern sich nicht sekündlich.
// -----------------------------------------------------------------------------

export const revalidate = 900;

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `#${decoded} — Serlo`,
    description: `Alle Posts mit #${decoded} auf Serlo`,
    openGraph: {
      title: `#${decoded} auf Serlo`,
      description: `Entdecke Videos und Posts mit #${decoded}`,
    },
  };
}

function formatCount(n: number, locale: Locale): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString(LOCALE_INTL[locale]);
}

export default async function HashtagPage({ params }: PageProps) {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag).toLowerCase().replace(/^#/, '').trim();

  if (!tag || tag.length > 100) notFound();

  const [posts, trending, locale] = await Promise.all([
    getPostsByTag(tag, 48),
    getTrendingHashtags(10),
    getLocale(),
  ]);

  const totalViews = posts.reduce((sum, p) => sum + (p.view_count ?? 0), 0);
  const rank = trending.findIndex((h) => h.tag === tag);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 lg:px-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold">
            <Hash className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">#{tag}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Film className="h-3.5 w-3.5" />
                {formatCount(posts.length, locale)} Posts
              </span>
              {totalViews > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatCount(totalViews, locale)} Aufrufe
                </span>
              )}
              {rank >= 0 && (
                <span className="flex items-center gap-1 text-brand-gold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  #{rank + 1} Trending
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Post-Grid */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
          <Hash className="h-10 w-10 opacity-30" />
          <p className="text-sm">Noch keine Posts mit #{tag}.</p>
          <Link
            href={'/explore' as Route}
            className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
          >
            Andere Hashtags entdecken
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {posts.map((p) => {
            const initial =
              (p.author.display_name ?? p.author.username ?? '?').slice(0, 1).toUpperCase();
            return (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}` as Route}
                  className="group relative block aspect-[9/16] overflow-hidden rounded-lg bg-black"
                >
                  {p.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail_url}
                      alt={p.caption ?? `#${tag}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
                      <span className="text-3xl font-bold text-white/30">{initial}</span>
                    </div>
                  )}
                  {/* Overlay: Views + Caption */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2">
                    <div className="truncate text-xs font-medium text-white">
                      @{p.author.username}
                    </div>
                    {(p.view_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-white/70">
                        <Eye className="h-2.5 w-2.5" />
                        {formatCount(p.view_count ?? 0, locale)}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Related Hashtags */}
      {trending.filter((h) => h.tag !== tag).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ähnliche Hashtags
          </h2>
          <div className="flex flex-wrap gap-2">
            {trending
              .filter((h) => h.tag !== tag)
              .slice(0, 9)
              .map((h) => (
                <Link
                  key={h.tag}
                  href={`/t/${encodeURIComponent(h.tag)}` as Route}
                  className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-foreground/20 hover:bg-muted"
                >
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {h.tag}
                </Link>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}
