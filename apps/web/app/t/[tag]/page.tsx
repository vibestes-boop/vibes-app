import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { Hash, TrendingUp, Eye, Film } from 'lucide-react';
import { getPostsByTag, getTrendingHashtags } from '@/lib/data/feed';
import { HashtagGrid } from '@/components/explore/hashtag-grid';
import { getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

// -----------------------------------------------------------------------------
// /t/[tag] — Hashtag-Detail-Seite (v1.w.UI.41 + v1.w.UI.101 infinite scroll)
//
// Zeigt alle öffentlichen Posts mit dem gegebenen Hashtag, sortiert nach
// View-Count (populärste zuerst). Explore verlinkt hierher — bisher 404.
//
// v1.w.UI.101: Die initiale SSR-Charge lädt 24 Posts. HashtagGrid übernimmt
// als Client-Shell und lädt weitere Seiten via
// GET /api/feed/hashtag/[tag]?offset=N&limit=24 nach.
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
    twitter: {
      card: 'summary_large_image',
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
    getPostsByTag(tag, 24), // First page; HashtagGrid handles further pages client-side
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

      {/* Post-Grid — v1.w.UI.101: HashtagGrid als Client-Shell mit infinite scroll */}
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
        <HashtagGrid initialPosts={posts} tag={tag} />
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
