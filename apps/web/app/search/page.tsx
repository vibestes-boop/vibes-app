import Link from 'next/link';
import type { Route } from 'next';
import { Search, TrendingUp, Hash } from 'lucide-react';
import { searchAll, getTrendingHashtags } from '@/lib/data/feed';
import { getViewerFollowingSet } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { SearchBox } from '@/components/search-box';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchResultsTabs } from './search-results-tabs';

// -----------------------------------------------------------------------------
// /search?q=…&tab=all|users|posts|hashtags
//
// v1.w.UI.95 — Search UX-Polish:
//   - Tab-Switching jetzt client-seitig (SearchResultsTabs) → instant, kein Reload.
//   - Leerer Zustand (kein Query) zeigt jetzt Trending-Hashtags statt nur Text.
//   - Tote search-results.tsx gelöscht.
//   - server.tsx bleibt Server-Component (nur Datenfetch).
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Suche — Serlo',
  description: 'Finde Accounts, Videos und Hashtags auf Serlo.',
};

type Tab = 'all' | 'users' | 'posts' | 'hashtags';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q = '', tab: rawTab = 'all' } = await searchParams;
  const tab: Tab = (['all', 'users', 'posts', 'hashtags'] as const).includes(rawTab as Tab)
    ? (rawTab as Tab)
    : 'all';

  const trimmed = q.trim();
  const hasQuery = trimmed.length >= 2;

  const [results, viewer, followingSet, trending] = await Promise.all([
    hasQuery
      ? searchAll(trimmed, 20)
      : Promise.resolve({ users: [], posts: [], hashtags: [] }),
    getUser(),
    getViewerFollowingSet(),
    // Trending nur für leeren Zustand; kostet nichts extra wenn cached
    hasQuery ? Promise.resolve([]) : getTrendingHashtags(12),
  ]);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Search className="h-7 w-7" />
          Suche
        </h1>
        <div className="mt-4">
          <SearchBox initialQuery={trimmed} />
        </div>
      </header>

      {!hasQuery ? (
        /* ── Leer-Zustand: Trending Hashtags ──────────────────────────────── */
        <div>
          <EmptyState
            icon={<Search className="h-8 w-8" strokeWidth={1.75} />}
            title="Los, suche was"
            description="Tippe mindestens 2 Zeichen, um Accounts, Videos oder Hashtags zu finden."
            size="sm"
          />

          {trending.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Trending Hashtags
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {trending.map((ht) => (
                  <li key={ht.tag}>
                    <Link
                      href={`/t/${encodeURIComponent(ht.tag)}` as Route}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">#{ht.tag}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {formatCount(ht.post_count)} Posts
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        /* ── Suchergebnisse mit client-seitigen Tabs ──────────────────────── */
        <SearchResultsTabs
          q={trimmed}
          results={results}
          viewerId={viewer?.id ?? null}
          followingSet={followingSet}
          initialTab={tab}
        />
      )}
    </main>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}
