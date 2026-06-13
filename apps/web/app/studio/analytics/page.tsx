import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import {
  Eye,
  Clock3,
  Users,
  Film,
  Image as ImageIcon,
  BarChart2,
  Globe,
  MapPin,
  UserCircle2,
  Users2,
  TrendingUp,
} from 'lucide-react';
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
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Detaillierte Creator-Metriken — Follower-Wachstum, Peak-Hours, Watch-Time.',
};

export const dynamic = 'force-dynamic';

const VALID_PERIODS: Period[] = [7, 28, 90];
const VALID_SORTS = ['views', 'likes', 'comments'] as const;
type Sort = (typeof VALID_SORTS)[number];

const VALID_TABS = ['viewers', 'rewards'] as const;
type Tab = (typeof VALID_TABS)[number];

function periodDateRange(period: Period): string {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - period + 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default async function StudioAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const requestedPeriod = Number(sp.period);
  const period: Period = VALID_PERIODS.includes(requestedPeriod as Period)
    ? (requestedPeriod as Period)
    : 28;

  const sort: Sort = VALID_SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : 'views';
  const tab: Tab = VALID_TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'viewers';

  const [growth, peakHours, watchTime, topPosts, overview] = await Promise.all([
    getFollowerGrowth(period),
    getPeakHours(period),
    getWatchTime(period),
    getCreatorTopPosts(sort, 20),
    getCreatorOverview(period),
  ]);

  const views = watchTime?.totalViews ?? 0;
  const newFollowers = overview?.newFollowers ?? 0;
  const totalFollowers = overview?.totalFollowers ?? 0;
  const liveDuration = watchTime?.totalSecondsEst ?? 0;
  // Diamonds placeholder — no real data source yet, use 0
  const diamonds = 0;
  // Likes proxy: use newFollowers * some factor or just 0
  const likes = 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Übersicht</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deine LIVE-Performance auf einen Blick.
          </p>
        </div>
        <PeriodTabs period={period} basePath="/studio/analytics" />
      </header>

      {/* ── Schlüsselmetriken card ── */}
      <section className="rounded-xl border bg-card">
        {/* Card header */}
        <div className="border-b px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold">Schlüsselmetriken</h2>
        </div>

        {/* Tab row 1: Viewers | Rewards */}
        <div className="flex items-center gap-1 border-b px-5 py-2">
          <TabLink
            label="Zuschauer*innen"
            tabKey="viewers"
            currentTab={tab}
            period={period}
            sort={sort}
          />
          <TabLink
            label="Belohnungen"
            tabKey="rewards"
            currentTab={tab}
            period={period}
            sort={sort}
          />
        </div>

        {/* Filter + date row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            <FilterPill label="Alle" active />
            <FilterPill label="Von Followern" active={false} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {periodDateRange(period)}
          </span>
        </div>

        {/* Metric cells — 4 col divide-x */}
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          <MetricCell
            label="Aufrufe"
            icon={Eye}
            value={views.toLocaleString('de-DE')}
            sub="Views gesamt"
          />
          <MetricCell
            label="Diamanten"
            icon={BarChart2}
            value={diamonds.toLocaleString('de-DE')}
            sub="Erhaltene Geschenke"
          />
          <MetricCell
            label="Gefällt mir"
            icon={TrendingUp}
            value={likes.toLocaleString('de-DE')}
            sub="Interaktion"
          />
          <MetricCell
            label="LIVE-Dauer"
            icon={Clock3}
            value={formatDuration(liveDuration)}
            sub="Aktivität"
          />
        </div>

        {/* Chart area */}
        <div className="border-t px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Follower-Wachstum · Neu in {period} T:{' '}
              <strong className="text-foreground">+{newFollowers.toLocaleString('de-DE')}</strong>
            </span>
            <span className="text-xs text-muted-foreground">
              Gesamt: {totalFollowers.toLocaleString('de-DE')}
            </span>
          </div>
          {growth.length > 0 ? (
            <FollowerGrowthChart points={growth} />
          ) : (
            <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg bg-muted/30 text-muted-foreground">
              <BarChart2 className="h-6 w-6 opacity-40" />
              <span className="text-xs">Nicht genügend Daten</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Lerne deine Zuschauer*innen kennen ── */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="text-base font-semibold">Lerne deine Zuschauer*innen kennen</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mehr Einblicke nach mehr LIVE-Aktivität.
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          <AudienceInsightCell icon={Globe} label="Traffic-Quelle" />
          <AudienceInsightCell icon={MapPin} label="Land oder Region" />
          <AudienceInsightCell icon={UserCircle2} label="Alter" />
          <AudienceInsightCell icon={Users2} label="Geschlecht" />
        </div>
      </section>

      {/* ── Peak-Hours Heatmap ── */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Peak-Hours</h2>
          <p className="text-xs text-muted-foreground">
            Wann ist dein Publikum am aktivsten? Je dunkler, desto mehr Likes + Kommentare kommen
            in diesem Stundenslot.
          </p>
        </div>
        <PeakHoursHeatmap cells={peakHours} />
      </section>

      {/* ── Top-Posts ── */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Top-Posts</h2>
          <div className="flex items-center gap-1 rounded-full border p-1 text-xs">
            <SortPill label="Views" sortKey="views" currentSort={sort} period={period} tab={tab} />
            <SortPill label="Likes" sortKey="likes" currentSort={sort} period={period} tab={tab} />
            <SortPill
              label="Kommentare"
              sortKey="comments"
              currentSort={sort}
              period={period}
              tab={tab}
            />
          </div>
        </div>

        {topPosts.length === 0 ? (
          <EmptyState
            icon={<Film className="h-7 w-7" strokeWidth={1.75} />}
            title="Keine Daten"
            description="Noch keine Posts mit Daten im gewählten Zeitraum."
            size="sm"
          />
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

function TabLink({
  label,
  tabKey,
  currentTab,
  period,
  sort,
}: {
  label: string;
  tabKey: Tab;
  currentTab: Tab;
  period: Period;
  sort: Sort;
}) {
  const active = tabKey === currentTab;
  const href = `/studio/analytics?period=${period}&sort=${sort}&tab=${tabKey}` as Route;
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-muted font-semibold text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

function FilterPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        active
          ? 'bg-foreground text-background'
          : 'border text-muted-foreground hover:text-foreground cursor-pointer',
      )}
    >
      {label}
    </span>
  );
}

function MetricCell({
  label,
  icon: Icon,
  value,
  sub,
}: {
  label: string;
  icon: typeof Eye;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function AudienceInsightCell({ icon: Icon, label }: { icon: typeof Globe; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">Nicht genügend Daten</div>
    </div>
  );
}

function SortPill({
  label,
  sortKey,
  currentSort,
  period,
  tab,
}: {
  label: string;
  sortKey: Sort;
  currentSort: Sort;
  period: Period;
  tab: Tab;
}) {
  const active = sortKey === currentSort;
  const href = `/studio/analytics?period=${period}&sort=${sortKey}&tab=${tab}` as Route;

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
    success: 'bg-muted text-muted-foreground',
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
