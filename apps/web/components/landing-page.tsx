import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowRight, Gamepad2, ShoppingBag, Radio, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { LiveSessionWithHost } from '@/lib/data/live';
import type { FeedPost } from '@/lib/data/feed';
import type { ShopProduct } from '@/lib/data/shop';
import { ExploreVideoCard } from '@/components/explore/explore-video-card';
import { ProductCard } from '@/components/shop/product-card';
import { getT } from '@/lib/i18n/server';
import { HeroHorizon, type HeroLayout } from '@/components/hero/hero-horizon';
import heroLayoutJson from '@/public/hero/hero-layout.json';

// Zaurs im Hero-Editor komponierte Berg-Szene (Sonnenaufgang, Wolken, Türme).
const heroLayout = heroLayoutJson as unknown as HeroLayout;

// Regions-neutraler Store-Link: Apple leitet automatisch in den Länder-Store.
const APP_STORE_URL = 'https://apps.apple.com/app/serlo/id6760790424';

// -----------------------------------------------------------------------------
// Landing-Page für ausgeloggte Besucher — durchgehend DARK (erzwungen via
// `dark`-Wrapper, unabhängig vom System-Theme), passend zur Hero-Nachtszene.
//
// Aufbau: fixe Glas-Navbar → Hero (WebGL-Sonnenaufgang) → Live → Marktplatz
// (Produkt-Vorschau, Conversion-Kern) → Trending → Value-Props → App-CTA-Band
// → Footer. Sections rendern nur mit Daten; Reihenfolge = Kaufpfad.
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
  shopProducts?: ShopProduct[];
}

export async function LandingPage({ featured, liveNow, trendingPosts, shopProducts = [] }: LandingPageProps) {
  const t = await getT();
  return (
    <main className="dark min-h-dvh bg-background text-foreground antialiased" data-testid="public-landing">

      {/* ── Navbar — fix, Glas, über allem ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Serlo">
            <Image src="/icon.svg" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-[9px]" priority />
            <span className="text-[15px] font-semibold tracking-tight text-white">Serlo</span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              className="h-9 rounded-full px-4 text-sm text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href={'/login' as Route}>{t('auth.login')}</Link>
            </Button>
            <Button
              asChild
              className="h-9 rounded-full bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
            >
              <Link href={'/signup' as Route}>{t('auth.signup')}</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero — Zaurs Silhouetten-Szene mit Sonnenaufgang ── */}
      <HeroHorizon layout={heroLayout} className="min-h-[88svh]">
        <section className="container mx-auto flex min-h-[88svh] flex-col items-center justify-center px-4 pb-16 pt-28 text-center sm:pb-20">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-1.5 text-sm text-white/85 backdrop-blur-sm">
            {liveNow.length > 0 ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                {liveNow.length === 1 ? t('landing.streamsLiveOne') : t('landing.streamsLiveMany', { count: liveNow.length })}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
                {t('landing.betaBadge')}
              </>
            )}
          </div>

          <h1 className="max-w-4xl text-[2.75rem] font-bold leading-[1.05] tracking-tighter text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)] sm:text-6xl md:text-7xl">
            {t('landing.heroTitle')}
            <br />
            <span className="text-white/60">{t('landing.heroSubtitle')}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/75 drop-shadow-[0_1px_10px_rgba(0,0,0,0.6)] sm:text-lg">
            {t('landing.heroText')}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="xl"
              className="rounded-full bg-white px-8 font-semibold text-black shadow-[0_8px_30px_rgba(255,255,255,0.18)] hover:bg-white/90"
            >
              <Link href={'/signup' as Route}>
                {t('auth.signup')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="rounded-full border-white/25 bg-white/10 px-8 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            >
              <Link href={'/login' as Route}>{t('auth.login')}</Link>
            </Button>
          </div>

          {/* App-Download: Badge (klickbar) + QR für Desktop-Besucher */}
          <div className="mt-12 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('landing.appStoreAlt')}
                className="transition-transform hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/badges/app-store-de.svg" alt={t('landing.appStoreAlt')} className="h-11 w-auto" />
              </a>
              <div className="hidden items-center rounded-xl border border-white/15 bg-white p-1.5 sm:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/badges/app-qr.svg" alt="QR-Code" className="h-16 w-16" />
              </div>
            </div>
            <p className="hidden text-xs text-white/40 sm:block">{t('landing.scanQr')}</p>
          </div>
        </section>
      </HeroHorizon>

      {/* ── Jetzt live ── */}
      {liveNow.length > 0 && (
        <section className="container mx-auto px-4 pt-16 sm:pt-20">
          <SectionHeader
            label={t('landing.liveLabel')}
            title={t('landing.liveNow')}
            live
            href={'/live' as Route}
            linkText={t('landing.allStreams')}
          />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveNow.map((s) => (
              <LiveMiniCard key={s.id} session={s} unknownHost={t('landing.unknownHost')} liveStreamAlt={t('landing.liveStreamAlt')} />
            ))}
          </ul>
        </section>
      )}

      {/* ── Trending ── */}
      {trendingPosts.length > 0 && (
        <section className="container mx-auto px-4 pt-16 sm:pt-20">
          <SectionHeader
            label={t('landing.trendingLabel')}
            title={t('landing.trending')}
            href={'/explore' as Route}
            linkText={t('landing.discoverMore')}
          />
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

      {/* ── Marktplatz — Produkt-Vorschau (Conversion-Kern, unter den Posts) ── */}
      {shopProducts.length > 0 && (
        <section className="container mx-auto px-4 pt-16 sm:pt-20">
          <SectionHeader
            label={t('landing.shopLabel')}
            title={t('landing.shopTitle')}
            sub={t('landing.shopSub')}
            href={'/shop' as Route}
            linkText={t('landing.shopAll')}
          />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {shopProducts.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-center sm:hidden">
            <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
              <Link href={'/shop' as Route}>
                {t('landing.shopAll')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── Value-Props ── */}
      <section className="container mx-auto px-4 pt-16 sm:pt-20">
        <SectionHeader label={t('landing.featuresLabel')} title={t('landing.featuresTitle')} />
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <ValueCard
            icon={<Gamepad2 className="h-5 w-5" />}
            title={t('landing.vpStreamerTitle')}
            description={t('landing.vpStreamerDesc')}
          />
          <ValueCard
            icon={<ShoppingBag className="h-5 w-5" />}
            title={t('landing.vpSellerTitle')}
            description={t('landing.vpSellerDesc')}
          />
          <ValueCard
            icon={<Radio className="h-5 w-5" />}
            title={t('landing.vpCreatorTitle')}
            description={t('landing.vpCreatorDesc')}
          />
        </div>
      </section>

      {/* ── Creator Discovery-Strip (rendert nur mit Daten) ── */}
      {featured.length > 0 && (
        <section className="container mx-auto px-4 pt-16 sm:pt-20">
          <SectionHeader label={t('landing.trendingLabel')} title={t('landing.discoverCreators')} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((c) => (
              <li key={c.username}>
                <Link
                  href={`/u/${c.username}` as Route}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center transition-colors hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {/* ── App-CTA-Band ── */}
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#2D0050] via-[#170433] to-[#0a0114] px-6 py-14 text-center sm:px-12 sm:py-20">
          {/* Glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(ellipse,rgba(167,139,250,0.22)_0%,transparent_70%)]"
          />
          <div className="relative flex flex-col items-center gap-5">
            <Image src="/icon.svg" alt="" width={64} height={64} className="h-16 w-16 rounded-[22%] shadow-2xl shadow-purple-950/60" />
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {t('landing.ctaTitle')}
            </h2>
            <p className="max-w-md text-sm text-white/60 sm:text-base">{t('landing.ctaText')}</p>
            <div className="mt-2 flex items-center gap-4">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('landing.appStoreAlt')}
                className="transition-transform hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/badges/app-store-de.svg" alt={t('landing.appStoreAlt')} className="h-12 w-auto" />
              </a>
              <div className="hidden items-center rounded-xl bg-white p-1.5 sm:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/badges/app-qr.svg" alt="QR-Code" className="h-16 w-16" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06]">
        <div className="container mx-auto flex flex-col items-center justify-between gap-5 px-4 py-10 text-sm text-white/45 md:flex-row">
          <div className="flex items-center gap-2.5">
            <Image src="/icon.svg" alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-md opacity-80" />
            <span>© {new Date().getFullYear()} Serlo</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href={'/terms' as Route} className="transition-colors hover:text-white">{t('landing.terms')}</Link>
            <Link href={'/privacy' as Route} className="transition-colors hover:text-white">{t('feed.privacyLink')}</Link>
            <Link href={'/imprint' as Route} className="transition-colors hover:text-white">{t('feed.imprintLink')}</Link>
            <Link href={'/widerruf' as Route} className="transition-colors hover:text-white">{t('feed.withdrawalLink')}</Link>
            <Link href={'/support' as Route} className="transition-colors hover:text-white">{t('landing.support')}</Link>
          </nav>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('landing.appStoreAlt')}
            className="opacity-80 transition-opacity hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badges/app-store-de.svg" alt={t('landing.appStoreAlt')} className="h-8 w-auto" />
          </a>
        </div>
      </footer>
    </main>
  );
}

// -----------------------------------------------------------------------------
// SectionHeader — einheitlicher Kopf aller Landing-Sections:
// kleines Uppercase-Label, große Headline (optional Live-Dot), optional Sub
// und rechts ein „Alle …"-Link.
// -----------------------------------------------------------------------------
function SectionHeader({
  label,
  title,
  sub,
  live = false,
  href,
  linkText,
}: {
  label: string;
  title: string;
  sub?: string;
  live?: boolean;
  href?: Route;
  linkText?: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">{label}</p>
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {live && (
            <span className="relative flex h-3 w-3 flex-none">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          )}
          <span className="truncate">{title}</span>
        </h2>
        {sub && <p className="mt-2 max-w-xl text-sm text-white/50">{sub}</p>}
      </div>
      {href && linkText && (
        <Link
          href={href}
          className="hidden flex-none items-center gap-1 text-sm font-medium text-white/60 transition-colors hover:text-white sm:inline-flex"
        >
          {linkText}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
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
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/20 hover:bg-white/[0.05]"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-black/40">
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
              <Radio className="h-8 w-8 text-white/20" />
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
          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-white/10">
            {session.host?.avatar_url ? (
              <Image
                src={session.host.avatar_url}
                alt={hostName}
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-bold text-white">
                {hostName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{session.title ?? liveStreamAlt}</p>
            <p className="truncate text-[11px] text-white/50">{hostName}</p>
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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-purple/15 text-brand-purple">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p>
    </article>
  );
}
