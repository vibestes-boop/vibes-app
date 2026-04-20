import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Eye, Heart, MessageCircle, Clock3, Users, Film, Image as ImageIcon } from 'lucide-react';
import {
  getFollowerGrowth,
  getPeakHours,
  getWatchTime,
  getCreatorTopPosts,
  getCreatorOverview,
  type Period,
} from '@/lib/data/studio';
import { PeriodTabs } from '@/components/studio/period-tabs';
import { FollowerGrowthChart } from '@/components/studio/follower-growth-chart';
import { PeakHoursHeatmap } from '@/components/studio/peak-hours-heatmap';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// /studio/analytics — Detail-Charts die im Dashboard keinen Platz haben.
//
// Inhalt:
// - Follower-Growth als kompaktes SVG-Line/Bar-Chart.
// - Peak-Hours-Heatmap 7×24 (Wochentag × Stunde, `engagement_count` als Zelle).
// - Watch-Time-Estimate-Panel (Gesamt-Sekunden, Views, avg/View).
// - Top-Posts-Tabelle mit sortierbaren Spalten via `?sort=views|likes|comments`.
//
// Charts sind reine SSR-Renderings — kein Chart-Lib, nur Tailwind + SVG. Damit
// kein Client-Bundle-Overhead und identische Experience ohne JS.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Detaillierte Creator-Metriken — Follower-Wachstum, Peak-Hours, Watch-Time.',
};

export const dynamic = 'force-dynamic';

const VALID_PERIODS: Period[] = [7, 28, 90];
const VALID_SORTS = ['views', 'likes', 'comments'] as const;
type Sort = (typeof VALID_SORTS)[number];

export default async function StudioAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const requestedPeriod = Number(sp.period);
  const period: Period = VALID_PERIODS.includes(requestedPeriod as Period)
    ? (requestedPeriod as Period)
    : 28;

  const sort: Sort = VALID_SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : 'views';

  const [growth, peakHours, watchTime, topPosts, overview] = await Promise.all([
    getFollowerGrowth(period),
    getPeakHours(period),
    getWatchTime(period),
    getCreatorTopPosts(sort, 20),
    getCreatorOverview(period),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detaillierte Metriken für den gewählten Zeitraum.
          </p>
        </div>
        <PeriodTabs period={period} basePath="/studio/analytics" />
      </header>

      {/* Follower-Growth */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Follower-Wachstum</h2>
            <p className="text-xs text-muted-foreground">
              Neue Follower pro Tag im Zeitraum — zeigt Spikes bei viralen Posts.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Neu in {period} T</div>
            <div className="text-lg font-semibold tabular-nums">
              +{(overview?.newFollowers ?? 0).toLocaleString('de-DE')}
            </div>
          </div>
        </div>
        <FollowerGrowthChart points={growth} />
      </section>

      {/* Watch-Time Estimate */}
      <section className="grid gap-3 md:grid-cols-3">
        <StatBigCard
          icon={Clock3}
          label="Watch-Time (geschätzt)"
          primary={formatDuration(watchTime?.totalSecondsEst ?? 0)}
          secondary="Summe aller Views × 8s Schätzung (Native-Parität)"
          accent="primary"
        />
        <StatBigCard
          icon={Eye}
          label="Views"
          primary={(watchTime?.totalViews ?? 0).toLocaleString('de-DE')}
          secondary={`Ø ${Math.round(watchTime?.avgSecondsPerView ?? 8).toLocaleString('de-DE')}s/View`}
          accent="muted"
        />
        <StatBigCard
          icon={Users}
          label="Gesamt-Follower"
          primary={(overview?.totalFollowers ?? 0).toLocaleString('de-DE')}
          secondary={`+${(overview?.newFollowers ?? 0).toLocaleString('de-DE')} im Zeitraum`}
          accent="success"
        />
      </section>

      {/* Peak-Hours-Heatmap */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Peak-Hours</h2>
          <p className="text-xs text-muted-foreground">
            Wann ist dein Publikum am aktivsten? Je dunkler, desto mehr Likes + Kommentare
            kommen in diesem Stundenslot.
          </p>
        </div>
        <PeakHoursHeatmap cells={peakHours} />
      </section>

      {/* Top-Posts-Table mit Sort-Links */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Top-Posts</h2>
          <div className="flex items-center gap-1 rounded-full border p-1 text-xs">
            <SortPill label="Views" sortKey="views" currentSort={sort} period={period} />
            <SortPill label="Likes" sortKey="likes" currentSort={sort} period={period} />
            <SortPill
              label="Kommentare"
              sortKey="comments"
              currentSort={sort}
              period={period}
            />
          </div>
        </div>

        {topPosts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Film className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Noch keine Posts mit Daten im gewählten Zeitraum.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Post</th>
                  <th className="px-4 py-2 text-right font-medium">Views</th>
                  <th className="px-4 py-2 text-right font-medium">Likes</th>
                  <th className="px-4 py-2 text-right font-medium">Kommentare</th>
                  <th className="px-4 py-2 text-right font-medium">ER</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((p) => {
                  const thumb = p.thumbnailUrl ?? (p.mediaType === 'image' ? p.mediaUrl : null);
                  const er =
                    p.viewCount > 0 ? ((p.likeCount + p.commentCount) / p.viewCount) * 100 : 0;
                  return (
                    <tr key={p.postId} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-2 align-middle text-xs tabular-nums text-muted-foreground">
                        #{p.rank}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/p/${p.postId}` as Route}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {thumb ? (
                              <Image
                                src={thumb}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-muted-foreground">
                                {p.mediaType === 'video' ? (
                                  <Film className="h-4 w-4" />
                                ) : (
                                  <ImageIcon className="h-4 w-4" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 max-w-[28ch]">
                            <div className="truncate text-sm">
                              {p.caption?.trim() || (
                                <span className="italic text-muted-foreground">Ohne Caption</span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {new Date(p.createdAt).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                              })}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.viewCount.toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.likeCount.toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.commentCount.toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                        {er.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

function SortPill({
  label,
  sortKey,
  currentSort,
  period,
}: {
  label: string;
  sortKey: Sort;
  currentSort: Sort;
  period: Period;
}) {
  const active = sortKey === currentSort;
  const href = `/studio/analytics?period=${period}&sort=${sortKey}` as Route;

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

function StatBigCard({
  icon: Icon,
  label,
  primary,
  secondary,
  accent,
}: {
  icon: typeof Eye;
  label: string;
  primary: string;
  secondary: string;
  accent: 'primary' | 'success' | 'muted';
}) {
  const iconBg = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    muted: 'bg-muted text-muted-foreground',
  }[accent];

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', iconBg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 truncate text-xl font-semibold tabular-nums">{primary}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{secondary}</div>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return `${hours}h ${remMin}min`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}T ${remHours}h`;
}
