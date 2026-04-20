import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Heart,
  MessageCircle,
  UserPlus,
  Gem,
  Clock,
  FileText,
  Radio,
  ShoppingBag,
  Flame,
  ArrowRight,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import { getProfile } from '@/lib/auth/session';
import {
  getCreatorOverview,
  getCreatorEarnings,
  getCreatorTopPosts,
  getCreatorGiftHistory,
  getMyLiveSessionsCount,
  getMyScheduledCount,
  getMyDraftsCount,
  getShopRevenue,
  type Period,
} from '@/lib/data/studio';
import { cn } from '@/lib/utils';
import { PeriodTabs } from '@/components/studio/period-tabs';

// -----------------------------------------------------------------------------
// /studio — Creator-Dashboard-Root.
//
// Strategie:
// - Server-Component, lädt alle Daten parallel via Promise.all.
// - Period-Tab (7T/28T/90T) via `?period=` Suchparameter — Client-Tab-Button
//   pusht einen Query-Param, Layout bleibt cached wegen Next-Route-Segments.
// - Jede Sektion hat eigene Fallback-Kacheln bei leeren/fehlenden Daten. Das
//   Dashboard lädt nicht „all-or-nothing" — Creator ohne Gift-History sieht
//   Views trotzdem, Creator ohne Shop sieht Live-Metriken trotzdem.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Creator Studio',
  description: 'Dein Dashboard — Views, Einnahmen, Follower-Wachstum.',
};

export const dynamic = 'force-dynamic';

const VALID_PERIODS: Period[] = [7, 28, 90];

export default async function StudioDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const requestedPeriod = Number(sp.period);
  const period: Period = VALID_PERIODS.includes(requestedPeriod as Period)
    ? (requestedPeriod as Period)
    : 28;

  const [profile, overview, earnings, topPosts, giftHistory, liveCount, scheduled, draftsCount, shopRevenue] =
    await Promise.all([
      getProfile(),
      getCreatorOverview(period),
      getCreatorEarnings(period),
      getCreatorTopPosts('views', 5),
      getCreatorGiftHistory(5),
      getMyLiveSessionsCount(period),
      getMyScheduledCount(),
      getMyDraftsCount(),
      getShopRevenue(period),
    ]);

  const username = profile?.display_name ?? profile?.username ?? 'Creator';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Flame className="h-3 w-3" />
            Creator Studio
          </div>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Hi, {username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dein Dashboard — alles auf einen Blick.
          </p>
        </div>
        <PeriodTabs period={period} basePath="/studio" />
      </header>

      {/* Diamonds Hero */}
      <DiamondsHero earnings={earnings} />

      {/* KPI Grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Reichweite</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Views"
            icon={Eye}
            value={overview?.totalViews ?? 0}
            prev={overview?.prevViews ?? 0}
          />
          <KpiCard
            label="Likes"
            icon={Heart}
            value={overview?.totalLikes ?? 0}
            prev={overview?.prevLikes ?? 0}
          />
          <KpiCard
            label="Kommentare"
            icon={MessageCircle}
            value={overview?.totalComments ?? 0}
            prev={overview?.prevComments ?? 0}
          />
          <KpiCard
            label="Neue Follower"
            icon={UserPlus}
            value={overview?.newFollowers ?? 0}
            prev={overview?.prevFollowers ?? 0}
          />
        </div>
      </section>

      {/* Engagement + Earnings Summary */}
      <section className="grid gap-3 md:grid-cols-3">
        <EngagementRateCard overview={overview} />
        <EarningsSummaryCard earnings={earnings} />
        <FollowerSummaryCard overview={overview} />
      </section>

      {/* Content Planning Row */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Content-Planung</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PlanningCard
            href={'/studio/scheduled' as Route}
            icon={Clock}
            label="Geplant"
            primary={scheduled.pending}
            secondary={scheduled.failed > 0 ? `${scheduled.failed} Fehler` : 'aktiv'}
            accent={scheduled.failed > 0 ? 'danger' : 'primary'}
          />
          <PlanningCard
            href={'/studio/drafts' as Route}
            icon={FileText}
            label="Entwürfe"
            primary={draftsCount}
            secondary="gespeichert"
            accent="muted"
          />
          <PlanningCard
            href={'/studio/live' as Route}
            icon={Radio}
            label="Live-Sessions"
            primary={liveCount}
            secondary={`in ${period} T`}
            accent="danger"
          />
          <PlanningCard
            href={'/studio/shop' as Route}
            icon={ShoppingBag}
            label="Shop-Umsatz"
            primary={`🪙 ${shopRevenue.totalCoinsEarned.toLocaleString('de-DE')}`}
            secondary={`${shopRevenue.completedOrders} Verkäufe`}
            accent="success"
          />
        </div>
      </section>

      {/* Two-Column: Top-Posts + Recent Gifts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <TopPostsPanel posts={topPosts} />
        <RecentGiftsPanel gifts={giftHistory} />
      </section>

      {/* CTA Row */}
      <section className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Mehr Details?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Die Analytics-Seite zeigt Follower-Wachstum, Peak-Hours und Watch-Time Estimates.
            </p>
          </div>
          <Link
            href={'/studio/analytics' as Route}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Zu Analytics
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Diamonds-Hero
// -----------------------------------------------------------------------------

function DiamondsHero({ earnings }: { earnings: Awaited<ReturnType<typeof getCreatorEarnings>> }) {
  const balance = earnings?.diamondsBalance ?? 0;
  const period = earnings?.periodDiamonds ?? 0;
  const gifts = earnings?.periodGifts ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-500/10 via-fuchsia-500/5 to-amber-500/10 p-5 sm:p-6">
      <div className="absolute -right-10 -top-10 grid h-40 w-40 place-items-center text-[160px] opacity-10">
        💎
      </div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gem className="h-3.5 w-3.5" />
            Diamanten-Balance
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
            💎 {balance.toLocaleString('de-DE')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {period > 0
              ? `+${period.toLocaleString('de-DE')} in diesem Zeitraum (${gifts.toLocaleString('de-DE')} Gifts)`
              : 'Keine Gifts im gewählten Zeitraum'}
          </div>
        </div>
        <Link
          href={'/studio/revenue' as Route}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background/50 px-4 py-2 text-sm font-medium backdrop-blur-md hover:bg-background"
        >
          Einnahmen-Details
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// KPI-Card mit Trend-Chip
// -----------------------------------------------------------------------------

function KpiCard({
  label,
  icon: Icon,
  value,
  prev,
}: {
  label: string;
  icon: typeof Eye;
  value: number;
  prev: number;
}) {
  const delta = prev > 0 ? ((value - prev) / prev) * 100 : value > 0 ? 100 : 0;
  const trend = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
            trend === 'up' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            trend === 'down' && 'bg-red-500/10 text-red-600 dark:text-red-400',
            trend === 'flat' && 'bg-muted text-muted-foreground',
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {delta > 0 ? '+' : ''}
          {delta.toFixed(0)}%
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString('de-DE')}</div>
      <div className="text-[11px] text-muted-foreground">
        vorher: {prev.toLocaleString('de-DE')}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Engagement/Earnings/Follower Summary (Small Cards)
// -----------------------------------------------------------------------------

function EngagementRateCard({
  overview,
}: {
  overview: Awaited<ReturnType<typeof getCreatorOverview>>;
}) {
  const views = overview?.totalViews ?? 0;
  const interactions = (overview?.totalLikes ?? 0) + (overview?.totalComments ?? 0);
  const rate = views > 0 ? (interactions / views) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Engagement-Rate
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{rate.toFixed(2)}%</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {interactions.toLocaleString('de-DE')} Interaktionen auf{' '}
        {views.toLocaleString('de-DE')} Views
      </div>
    </div>
  );
}

function EarningsSummaryCard({
  earnings,
}: {
  earnings: Awaited<ReturnType<typeof getCreatorEarnings>>;
}) {
  const top = earnings?.topGiftName;
  const emoji = earnings?.topGiftEmoji;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Top-Gift
      </div>
      {top ? (
        <>
          <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <span>{emoji ?? '🎁'}</span>
            <span className="truncate">{top}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Top-Supporter: {earnings?.topGifterName ?? '–'}
          </div>
        </>
      ) : (
        <>
          <div className="mt-1 text-2xl font-semibold text-muted-foreground">–</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Noch keine Gifts in diesem Zeitraum
          </div>
        </>
      )}
    </div>
  );
}

function FollowerSummaryCard({
  overview,
}: {
  overview: Awaited<ReturnType<typeof getCreatorOverview>>;
}) {
  const total = overview?.totalFollowers ?? 0;
  const added = overview?.newFollowers ?? 0;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Follower
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {total.toLocaleString('de-DE')}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        +{added.toLocaleString('de-DE')} neu im Zeitraum
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Content-Planning-Card
// -----------------------------------------------------------------------------

function PlanningCard({
  href,
  icon: Icon,
  label,
  primary,
  secondary,
  accent,
}: {
  href: Route;
  icon: typeof Eye;
  label: string;
  primary: number | string;
  secondary: string;
  accent: 'primary' | 'danger' | 'success' | 'muted';
}) {
  const accentRing = {
    primary: 'ring-primary/30 bg-primary/5',
    danger: 'ring-red-500/30 bg-red-500/5',
    success: 'ring-emerald-500/30 bg-emerald-500/5',
    muted: 'ring-muted',
  }[accent];

  const iconColor = {
    primary: 'text-primary',
    danger: 'text-red-500',
    success: 'text-emerald-500',
    muted: 'text-muted-foreground',
  }[accent];

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:ring-2',
        accentRing,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          {typeof primary === 'number' ? primary.toLocaleString('de-DE') : primary}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{secondary}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Top-Posts-Panel
// -----------------------------------------------------------------------------

function TopPostsPanel({ posts }: { posts: Awaited<ReturnType<typeof getCreatorTopPosts>> }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Top-Posts (Views)</h3>
        <Link
          href={'/studio/analytics' as Route}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Alle
        </Link>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Flame className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Noch keine Daten. Poste Content und schau hier in ein paar Stunden wieder vorbei.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {posts.map((p) => {
            const thumb = p.thumbnailUrl ?? (p.mediaType === 'image' ? p.mediaUrl : null);
            return (
              <li key={p.postId}>
                <Link
                  href={`/p/${p.postId}` as Route}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {thumb ? (
                      <Image src={thumb} alt="" fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        {p.mediaType === 'video' ? (
                          <Film className="h-5 w-5" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                      </div>
                    )}
                    <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                      {p.rank}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {p.caption?.trim() || (
                        <span className="italic text-muted-foreground">Ohne Caption</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {p.viewCount.toLocaleString('de-DE')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {p.likeCount.toLocaleString('de-DE')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {p.commentCount.toLocaleString('de-DE')}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Recent-Gifts-Panel
// -----------------------------------------------------------------------------

function RecentGiftsPanel({
  gifts,
}: {
  gifts: Awaited<ReturnType<typeof getCreatorGiftHistory>>;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Letzte Gifts</h3>
        <Link
          href={'/studio/revenue' as Route}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Alle
        </Link>
      </div>
      {gifts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Gem className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Noch keine Gifts empfangen. Gehe live — dann kommen sie.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {gifts.map((g, i) => (
            <li
              key={`${g.createdAt}-${i}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-2xl">
                {g.giftEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate font-medium">{g.giftName}</span>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-sky-600 dark:text-sky-400">
                    💎 {g.diamondValue.toLocaleString('de-DE')}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  von {g.senderName ?? '–'} · {relativeDE(g.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function relativeDE(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'gerade eben';
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min`;
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std`;
  if (diff < 7 * 86_400_000) return `vor ${Math.floor(diff / 86_400_000)} T`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
