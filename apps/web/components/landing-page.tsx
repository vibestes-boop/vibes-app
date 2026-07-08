import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowRight, Gamepad2, ShoppingBag, Radio, Sparkles, Compass, Users, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { LiveSessionWithHost } from '@/lib/data/live';
import type { FeedPost } from '@/lib/data/feed';
import { ExploreVideoCard } from '@/components/explore/explore-video-card';
import { getT } from '@/lib/i18n/server';
import { HeroHorizon, type HeroLayout } from '@/components/hero/hero-horizon';
import heroLayoutJson from '@/public/hero/hero-layout.json';

// Zaurs im Hero-Editor komponierte Berg-Szene (Sonnenaufgang, Wolken, Türme).
const heroLayout = heroLayoutJson as unknown as HeroLayout;

// -----------------------------------------------------------------------------
// Landing-Page für ausgeloggte Besucher.
// Server-Component, rein markup-lastig; die Daten kommen via Props.
//
// v1.w.UI.102: Zwei dynamische Sections hinzugefügt:
//  • "Jetzt live" — bis zu 4 aktive Live-Sessions mit Mini-Cards
//    (nur gerendert wenn Sessions vorhanden; wirbt für das Live-Feature)
//  • "Trending" — 6 Posts als horizontaler ExploreVideoCard-Strip
// -----------------------------------------------------------------------------

export type FeaturedCreator = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
};

interface LandingPageProps {
  featured: FeaturedCreator[];
  liveNow: LiveSessionWithHost[];
  trendingPosts: FeedPost[];
}

export async function LandingPage({ featured, liveNow, trendingPosts }: LandingPageProps) {
  const t = await getT();
  return (
    <main className="min-h-dvh bg-background" data-testid="public-landing">
      {/* Hero — Zaurs Silhouetten-Szene mit Sonnenaufgang, davor Text + CTAs */}
      <HeroHorizon layout={heroLayout} className="min-h-[82svh]">
        <section className="container mx-auto flex min-h-[82svh] flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
          <Link href="/" className="mb-5 flex items-center gap-3 rounded-full border border-white/15 bg-black/25 px-3 py-2 shadow-sm backdrop-blur-sm">
            <Image
              src="/icon.svg"
              alt="Serlo"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <span className="pr-1 text-sm font-semibold tracking-tight text-white">Serlo</span>
          </Link>

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-1.5 text-sm text-white/85 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
            {liveNow.length > 0
              ? (liveNow.length === 1 ? t('landing.streamsLiveOne') : t('landing.streamsLiveMany', { count: liveNow.length }))
              : t('landing.betaBadge')}
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)] sm:text-5xl md:text-7xl">
            {t('landing.heroTitle')}
            <br />
            <span className="text-white/65">{t('landing.heroSubtitle')}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/80 drop-shadow-[0_1px_10px_rgba(0,0,0,0.6)] sm:text-lg">
            {t('landing.heroText')}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="xl">
              <Link href={'/login' as Route}>
                {t('auth.login')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href={'/signup' as Route}>{t('auth.signup')}</Link>
            </Button>
          </div>
        </section>
      </HeroHorizon>

      {/* Jetzt live — nur wenn Streams aktiv sind */}
      {liveNow.length > 0 && (
        <section className="container mx-auto pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              {t('landing.liveNow')}
            </h2>
            <Link
              href={'/live' as Route}
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              {t('landing.allStreams')}
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {liveNow.map((s) => (
              <LiveMiniCard key={s.id} session={s} unknownHost={t('landing.unknownHost')} liveStreamAlt={t('landing.liveStreamAlt')} />
            ))}
          </ul>
        </section>
      )}

      {/* Trending Posts */}
      {trendingPosts.length > 0 && (
        <section className="container mx-auto pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Eye className="h-5 w-5 text-brand-gold" />
              {t('landing.trending')}
            </h2>
            <Link
              href={'/explore' as Route}
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              {t('landing.discoverMore')}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {trendingPosts.map((p) => {
              const fallback = (p.author.display_name ?? p.author.username ?? '?')
                .slice(0, 1)
                .toUpperCase();
              return (
                <li key={p.id}>
                  <ExploreVideoCard
                    id={p.id}
                    videoUrl={p.video_url}
                    thumbnailUrl={p.thumbnail_url}
                    mediaType={p.media_type}
                    caption={p.caption}
                    authorUsername={p.author.username}
                    viewCount={p.view_count ?? 0}
                    fallbackInitial={fallback}
                    womenOnly={p.women_only}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Value-Props */}
      <section className="container mx-auto grid gap-6 pb-20 md:grid-cols-3">
        <ValueCard
          icon={<Gamepad2 className="h-6 w-6" />}
          title={t('landing.vpStreamerTitle')}
          description={t('landing.vpStreamerDesc')}
          badge="Phase 6"
        />
        <ValueCard
          icon={<ShoppingBag className="h-6 w-6" />}
          title={t('landing.vpSellerTitle')}
          description={t('landing.vpSellerDesc')}
          badge="Phase 4"
        />
        <ValueCard
          icon={<Radio className="h-6 w-6" />}
          title={t('landing.vpCreatorTitle')}
          description={t('landing.vpCreatorDesc')}
          badge="Phase 9"
        />
      </section>

      {/* Creator Discovery-Strip */}
      {featured.length > 0 && (
        <section className="container mx-auto pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Compass className="h-5 w-5 text-brand-gold" />
              {t('landing.discoverCreators')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t('landing.noLoginNeeded')}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((c) => (
              <li key={c.username}>
                <Link
                  href={`/u/${c.username}` as Route}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={c.avatar_url ?? undefined} alt={c.display_name ?? c.username} />
                    <AvatarFallback>
                      {(c.display_name ?? c.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {c.display_name ?? `@${c.username}`}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatCount(c.follower_count)} {t('landing.followerUnit')}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} Serlo</span>
          <nav className="flex gap-6">
            <Link href={'/terms' as Route} className="hover:text-foreground">{t('landing.terms')}</Link>
            <Link href={'/privacy' as Route} className="hover:text-foreground">{t('feed.privacyLink')}</Link>
            <Link href={'/imprint' as Route} className="hover:text-foreground">{t('feed.imprintLink')}</Link>
            <Link href={'/widerruf' as Route} className="hover:text-foreground">{t('feed.withdrawalLink')}</Link>
            <Link href={'/support' as Route} className="hover:text-foreground">{t('landing.support')}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

// -----------------------------------------------------------------------------
// LiveMiniCard — kompakte Session-Karte für die Landing-"Jetzt live"-Section.
// Kein Client-State, kein Realtime — reine SSR-Snapshot-Ansicht.
// -----------------------------------------------------------------------------
function LiveMiniCard({ session, unknownHost, liveStreamAlt }: { session: LiveSessionWithHost; unknownHost: string; liveStreamAlt: string }) {
  const hostName = session.host?.display_name ?? session.host?.username ?? unknownHost;
  const viewerCount = session.viewer_count ?? 0;

  return (
    <li>
      <Link
        href={`/live/${session.id}` as Route}
        className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/50"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {session.thumbnail_url ? (
            <Image
              src={session.thumbnail_url}
              alt={session.title ?? liveStreamAlt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Radio className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
          {/* Live-Badge */}
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </div>
          {/* Viewer-Count */}
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Users className="h-2.5 w-2.5" />
            {viewerCount.toLocaleString('de-DE')}
          </div>
        </div>
        {/* Info */}
        <div className="flex items-center gap-2 p-2.5">
          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
            {session.host?.avatar_url ? (
              <Image
                src={session.host.avatar_url}
                alt={hostName}
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xs font-bold text-primary">
                {hostName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{session.title ?? liveStreamAlt}</p>
            <p className="truncate text-[11px] text-muted-foreground">{hostName}</p>
          </div>
        </div>
      </Link>
    </li>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

function ValueCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </article>
  );
}
