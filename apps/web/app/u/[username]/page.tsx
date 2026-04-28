import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Heart, Repeat2, ShoppingBag, Swords, Globe, Mountain, Radio, Bookmark } from 'lucide-react';

import { getPublicProfile, getProfilePosts, getProfileLikedPosts, getProfileReposts, getBattleHistory, getFollowState, getBookmarkedPosts, type ProfileSortKey } from '@/lib/data/public';
import { getUserReplays } from '@/lib/data/live';
import { getUser } from '@/lib/auth/session';
import { getMyCoinBalance } from '@/lib/data/payments';
import { getMerchantProducts } from '@/lib/data/shop';
import { isHostMuted } from '@/lib/data/live-host';
import { PostGrid } from '@/components/profile/post-grid';
import { ProductCard } from '@/components/shop/product-card';
import { BattleList } from '@/components/profile/battle-list';
import { ProfileBlockButton } from '@/components/profile/profile-block-button';
import { ProfileTabs, type ProfileTab } from '@/components/profile/profile-tabs';
import { FollowButton } from '@/components/profile/follow-button';
import { CreatorTipButton } from '@/components/profile/creator-tip-button';
import { LiveRingAvatar } from '@/components/profile/live-ring-avatar';
import { MuteHostButton } from '@/components/profile/mute-host-button';
import { getT, getLocale } from '@/lib/i18n/server';
import { LOCALE_INTL } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { linkify } from '@/lib/linkify';

// -----------------------------------------------------------------------------
// /u/[username] — public profile.
//
// ISR: 60s — Profil-Metadaten (Follower-Count, Bio, Posts-Liste) ändern sich
// selten genug dass 60s stale-content akzeptabel ist, aber gerade langsam genug
// dass jeder Seitenaufruf nicht gegen Supabase geht. Phase 11 bringt on-demand
// `revalidateTag()` wenn der User sein Profil bearbeitet.
// -----------------------------------------------------------------------------

export const revalidate = 60;
export const dynamicParams = true;

// -----------------------------------------------------------------------------
// Metadata — wird von Social-Previews (WhatsApp, Telegram, X, FB) verwendet.
// OG-Image kommt aus der eigenen Route `/u/[username]/opengraph-image`
// (später in diesem Phase gebaut).
// -----------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const [profile, t, locale] = await Promise.all([
    getPublicProfile(username),
    getT(),
    getLocale(),
  ]);

  if (!profile) {
    return {
      title: t('profile.metaNotFoundTitle', { username }),
      robots: { index: false, follow: false },
    };
  }

  const displayName = profile.display_name ?? `@${profile.username}`;
  const description =
    profile.bio?.slice(0, 160) ??
    t('profile.metaGenericDescription', {
      name: displayName,
      count: profile.follower_count.toLocaleString(LOCALE_INTL[locale]),
    });

  return {
    title: `${displayName} (@${profile.username})`,
    description,
    alternates: { canonical: `/u/${profile.username}` },
    openGraph: {
      type: 'profile',
      title: `${displayName} (@${profile.username})`,
      description,
      url: `/u/${profile.username}`,
      siteName: 'Serlo',
      username: profile.username,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} (@${profile.username})`,
      description,
    },
  };
}

// -----------------------------------------------------------------------------
// Helper: stat-pill (Followers / Following / Posts). Tabellen-Zahlen, damit
// sich die Pills nicht beim Tick von 1234 auf 1235 minimal verschieben.
//
// D3 aus UI_AUDIT: Compact-Formatting (1.2K / 45.3K / 1.2M) statt
// `toLocaleString(1,234)`. Tausender-Trenner frisst horizontalen Space und
// macht die drei Pills unterschiedlich breit, was den Stats-Row
// ungleich-gewichtet. Kompakte Notation balanciert die Breiten visuell aus und
// ist außerdem das TikTok-Signature-Pattern. Locale-separator (`.` in de-DE,
// `,` in en-US) kommt über ein kleines Replace nach dem toFixed.
//
// Gewicht-Shift: Value-Line `text-lg font-semibold` → `text-xl font-bold`
// (dominanter Zahl-Akzent), Label bleibt `text-xs`. Gap zwischen beiden von
// 0.5 → 0.25 eng, damit der Block als eine Einheit liest statt als
// „Nummer + darunter noch was".
// -----------------------------------------------------------------------------

function formatStat(n: number, locale: Locale): string {
  if (n < 1_000) return n.toLocaleString(LOCALE_INTL[locale]);
  const sep = (0.1).toLocaleString(LOCALE_INTL[locale]).charAt(1); // '.' or ','
  if (n < 1_000_000) {
    const val = (n / 1_000).toFixed(1).replace('.', sep);
    return `${val.endsWith(`${sep}0`) ? val.slice(0, -2) : val}K`;
  }
  const val = (n / 1_000_000).toFixed(1).replace('.', sep);
  return `${val.endsWith(`${sep}0`) ? val.slice(0, -2) : val}M`;
}

function StatPill({
  label,
  value,
  locale,
  href,
}: {
  label: string;
  value: number;
  locale: Locale;
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-xl font-bold tabular-nums leading-tight">
        {formatStat(value, locale)}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href as import('next').Route}
        className="flex flex-col items-center gap-px rounded-md transition-colors hover:text-foreground/80"
      >
        {inner}
      </Link>
    );
  }

  return <div className="flex flex-col items-center gap-px">{inner}</div>;
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

// v1.w.UI.212 — valid sort keys for the post-grid sort bar.
const VALID_SORTS = new Set<ProfileSortKey>(['newest', 'views', 'likes']);

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; sort?: string }>;
}) {
  const [{ username }, { tab: tabParam, sort: sortParam }] = await Promise.all([params, searchParams]);
  const sort: ProfileSortKey =
    sortParam && VALID_SORTS.has(sortParam as ProfileSortKey)
      ? (sortParam as ProfileSortKey)
      : 'newest';

  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  // Canonical redirect: /u/zAuR → /u/zaur (nur Komfort, 404 bleibt 404).
  // Wir rendern hier einfach mit dem normalisierten username, weil getPublicProfile
  // bereits lowercase-matcht — keine Redirect-Loop-Gefahr.

  const tab: ProfileTab =
    tabParam === 'likes' || tabParam === 'saved' || tabParam === 'reposts' || tabParam === 'shop' || tabParam === 'battles' || tabParam === 'lives'
      ? tabParam
      : 'posts';

  // Parallel: Session + Follow-Status + Posts-Feed + Coin-Balance + i18n
  // isSelf kann erst nach getUser() bestimmt werden — Likes-Fetch wird daher
  // zwei-stufig: erst viewer, dann (wenn isSelf && tab=likes) likedPosts.
  const [viewer, followState, posts, reposts, shopProducts, battles, replays, balance, hostMuted, t, locale] = await Promise.all([
    getUser(),
    getFollowState(profile.id),
    tab === 'posts' ? getProfilePosts(profile.id, 24, undefined, sort) : Promise.resolve([]),
    tab === 'reposts' ? getProfileReposts(profile.id, 48) : Promise.resolve([]),
    tab === 'shop' ? getMerchantProducts(profile.id, 48) : Promise.resolve([]),
    tab === 'battles' ? getBattleHistory(profile.id, 30) : Promise.resolve([]),
    tab === 'lives' ? getUserReplays(profile.id, 30) : Promise.resolve([]),
    getMyCoinBalance(),
    isHostMuted(profile.id),
    getT(),
    getLocale(),
  ]);

  const isSelf = viewer?.id === profile.id;

  // Liked + Saved Posts: nur für den Profilinhaber selbst (privat).
  const [likedPosts, savedPosts] = await Promise.all([
    tab === 'likes' && isSelf ? getProfileLikedPosts(profile.id, 24) : Promise.resolve([]),
    tab === 'saved' && isSelf ? getBookmarkedPosts(48) : Promise.resolve([]),
  ]);
  const displayName = profile.display_name ?? `@${profile.username}`;

  // JSON-LD (ProfilePage Schema.org) — hilft Google bei Rich-Results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: displayName,
      alternateName: `@${profile.username}`,
      description: profile.bio ?? undefined,
      image: profile.avatar_url ?? undefined,
      identifier: profile.username,
    },
  };

  return (
    <main className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ───── Hero ───── */}
      <section className="px-4 pb-4 pt-6 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* v1.w.UI.16: Avatar mit Gradient-Ring + LIVE-Badge wenn der User
              aktuell eine Session hostet (Daten kommen via getPublicProfile
              aus `live_sessions`-Tabelle). Wenn live, wird der Avatar zum
              Link auf `/live/[sessionId]` — gleiche Affordance wie auf
              TikTok/Instagram, wo man vom Profil direkt in den Stream
              springt. Bei non-live User fällt die Komponente auf den
              bisherigen `ring-4 ring-background`-Look zurück, keine Layout-
              Änderung. */}
          <LiveRingAvatar
            src={profile.avatar_url}
            alt={displayName}
            fallback={(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
            live={!!profile.is_live}
            liveHref={
              profile.is_live && profile.live_session_id
                ? `/live/${profile.live_session_id}`
                : undefined
            }
            sizeClassName="h-24 w-24 sm:h-28 sm:w-28"
            className="shrink-0"
            liveLinkLabel={t('profile.liveNow', { name: displayName })}
            liveBadgeLabel={t('profile.liveBadge')}
          />


          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-2xl font-semibold leading-none tracking-tight">
                {displayName}
              </h1>
              {profile.verified && (
                // Verified-Badge auf TikTok-Blau umgestellt (D3 aus UI_AUDIT).
                // Vorher: `fill-brand-gold text-background` — Gold-Stroke mit
                // Background-Farbe als Inner-Tint war sehr dezent, besonders
                // auf hellem Theme kaum vom Namen abgesetzt. Neu: Sky-Blue-Fill
                // mit Weiß-Innen — die universelle „Verified"-Farbgebung die
                // TikTok/X/Meta alle übernommen haben. Gleiches Pattern nutzt
                // die Messages-Liste und der Feed bereits (`text-sky-500` auf
                // den kleineren Check-Icons), damit ist die Seitenweiten-
                // Semantik konsistent.
                <BadgeCheck
                  className="h-5 w-5 fill-sky-500 text-white dark:text-background"
                  aria-label={t('profile.verifiedBadge')}
                />
              )}
            </div>

            <div className="text-sm text-muted-foreground">@{profile.username}</div>

            <div className="flex items-center gap-6 pt-1">
              <StatPill label={t('profile.statPosts')}     value={profile.post_count}      locale={locale} />
              <StatPill label={t('profile.statFollower')}  value={profile.follower_count}  locale={locale} href={`/u/${profile.username}/followers`} />
              <StatPill label={t('profile.statFollowing')} value={profile.following_count} locale={locale} href={`/u/${profile.username}/following`} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:self-start">
            <div className="flex items-center gap-2">
              <FollowButton
                isAuthenticated={!!viewer}
                isFollowing={followState.following}
                isPendingRequest={followState.pendingRequest}
                isSelf={isSelf}
                username={profile.username}
                targetUserId={profile.id}
              />
              {/* v1.w.UI.54: Block-Option für fremde eingeloggte User */}
              {viewer && !isSelf && (
                <ProfileBlockButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                />
              )}
              {/* v1.w.UI.156: Bell-Toggle — Go-Live Push stummschalten */}
              {viewer && !isSelf && (
                <MuteHostButton
                  hostId={profile.id}
                  initiallyMuted={hostMuted}
                />
              )}
            </div>
            <CreatorTipButton
              recipientId={profile.id}
              recipientName={profile.username}
              currentCoins={balance?.coins ?? null}
              isAuthenticated={!!viewer}
              isSelf={isSelf}
            />
          </div>
        </div>

        {profile.bio && (
          <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {linkify(profile.bio)}
          </p>
        )}

        {/* Website + Teip — v1.w.UI.160 */}
        {(profile.website || profile.teip) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            {profile.teip && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mountain className="h-3.5 w-3.5 shrink-0" />
                🏔️ {profile.teip}
              </span>
            )}
          </div>
        )}
      </section>

      {/* ───── Tab-Navigation ───── */}
      <ProfileTabs
        active={tab}
        counts={{
          posts: profile.post_count,
        }}
        labels={{
          tablist: t('profile.tablistLabel'),
          posts: t('profile.tabPosts'),
          likes: t('profile.tabLikes'),
          saved: 'Gespeichert',
          reposts: t('profile.tabReposts'),
          shop: t('profile.tabShop'),
          battles: t('profile.tabBattles'),
          lives: 'Lives',
        }}
        savedVisible={isSelf}
      />

      {/* ───── Panels ───── */}
      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="px-2 py-4 sm:px-3"
      >
        {tab === 'posts' && (
          <>
            {/* v1.w.UI.212 — Sort bar (server-rendered Link pills, no JS needed).
                Matches mobile's sort bar: views / likes / newest.
                Only shown when the profile has posts so it doesn't float above an EmptyState. */}
            {posts.length > 0 && (
              <nav aria-label="Sortierung" className="mb-3 flex gap-1.5 px-0.5">
                {(
                  [
                    { key: 'newest', label: '🕐 Neueste' },
                    { key: 'views',  label: '▶ Views'   },
                    { key: 'likes',  label: '♥ Likes'   },
                  ] as { key: ProfileSortKey; label: string }[]
                ).map(({ key, label }) => (
                  <Link
                    key={key}
                    href={`/u/${profile.username}?sort=${key}` as import('next').Route}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      sort === key
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    ].join(' ')}
                    aria-current={sort === key ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            <PostGrid
              posts={posts}
              emptyTitle={t('profile.emptyPostsTitle')}
              emptyDescription={
                isSelf
                  ? t('profile.emptyPostsSelf')
                  : t('profile.emptyPostsOther', { username: profile.username })
              }
              fetchMoreUrl={
                sort === 'newest'
                  ? `/api/posts/user/${profile.id}`
                  : `/api/posts/user/${profile.id}?sort=${sort}`
              }
              initialHasMore={posts.length >= 24}
            />
          </>
        )}

        {tab === 'likes' && (
          isSelf ? (
            // Eigener Account: echtes Liked-Grid mit infinite scroll (v1.w.UI.126)
            <PostGrid
              posts={likedPosts}
              emptyTitle="Noch nichts geliked"
              emptyDescription="Videos, die du likest, erscheinen hier — nur für dich sichtbar."
              emptyIcon={<Heart className="h-7 w-7" strokeWidth={1.75} />}
              fetchMoreUrl="/api/posts/liked"
              initialHasMore={likedPosts.length >= 24}
            />
          ) : (
            // Fremder Account: Likes sind privat
            <EmptyPanelInfo
              icon="likes"
              title={t('profile.panelLikesTitle')}
              hint={t('profile.panelLikesHintOther')}
            />
          )
        )}

        {tab === 'saved' && (
          isSelf ? (
            // v1.w.UI.203 — Saved/Bookmarks tab: own-profile only (parity with mobile 'saved' tab)
            <PostGrid
              posts={savedPosts}
              emptyTitle="Nichts gespeichert"
              emptyDescription="Bookmarkte Posts erscheinen hier — nur für dich sichtbar."
              emptyIcon={<Bookmark className="h-7 w-7" strokeWidth={1.75} />}
              fetchMoreUrl="/api/posts/bookmarked"
              initialHasMore={savedPosts.length >= 48}
            />
          ) : (
            <EmptyPanelInfo
              icon="likes"
              title="Gespeicherte Posts sind privat"
              hint="Nur der Profilinhaber kann seine gespeicherten Posts sehen."
            />
          )
        )}

        {tab === 'reposts' && (
          reposts.length > 0 ? (
            <PostGrid
              posts={reposts}
              emptyTitle={t('profile.emptyRepostsTitle')}
              emptyDescription={t('profile.emptyRepostsHint')}
              emptyIcon={<Repeat2 className="h-7 w-7" strokeWidth={1.75} />}
            />
          ) : (
            <EmptyPanelInfo
              icon="reposts"
              title={t('profile.emptyRepostsTitle')}
              hint={isSelf ? t('profile.emptyRepostsSelf') : t('profile.emptyRepostsOther', { username: profile.username })}
            />
          )
        )}

        {tab === 'shop' && (
          // v1.w.UI.51: echte Produkte via getMerchantProducts — zeigt auch
          // inaktive Produkte wenn isSelf (getMerchantProducts prüft Auth intern).
          // EmptyPanelInfo bleibt als Fallback für leere Shops.
          shopProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shopProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyPanelInfo
              icon="shop"
              title={t('profile.panelShopTitle')}
              hint={isSelf ? 'Erstelle dein erstes Produkt im Creator Studio.' : t('profile.panelShopHint')}
            />
          )
        )}

        {tab === 'battles' && (
          // v1.w.UI.52: echte Battle-History aus live_battle_history.
          // BattleList rendert W-L-D Summary + chronologische Rows.
          // Leerer State kommt aus BattleList selbst.
          <BattleList battles={battles} />
        )}

        {tab === 'lives' && (
          // v1.w.UI.173: Past live-stream replays for this profile.
          // getUserReplays returns only is_replayable=true sessions with a
          // replay_url — no dead links. Cards link to /live/replay/[id].
          replays.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {replays.map((session) => (
                <a
                  key={session.id}
                  href={`/live/replay/${session.id}`}
                  className="group relative overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[9/16] w-full overflow-hidden bg-muted">
                    {session.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.thumbnail_url}
                        alt={session.title ?? 'Live Replay'}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Radio className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  {/* Bottom gradient overlay */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 pb-2.5 pt-8">
                    {session.title && (
                      <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-white">
                        {session.title}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-white/70">
                      👁 {session.replay_views.toLocaleString(LOCALE_INTL[locale])}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <EmptyPanelInfo
              icon="lives"
              title="Keine Replays"
              hint={
                isSelf
                  ? 'Deine Live-Streams werden hier als Replay gespeichert.'
                  : `${profile.username} hat noch keine öffentlichen Replays.`
              }
            />
          )
        )}
      </section>
    </main>
  );
}

// -----------------------------------------------------------------------------
// EmptyPanelInfo — D3 aus UI_AUDIT
//
// Vorher: Ein generischer `Construction`-Icon in allen drei Empty-Tabs →
// „under construction"-Prototype-Feel, für den Audit-Kritikpunkt
// „absolut kein Design. ... wirkt nach 2022 Prototype". Neu:
//   1. Ein pro Tab passendes Icon (Heart/ShoppingBag/Swords — matcht die
//      jeweiligen Tab-Icons, sodass der User sofort sieht „das ist der
//      leere Likes-Tab, nicht eine generische Fehlerseite").
//   2. Gradient-Glow-Background (pink-500 → red-500 → amber-400, je nach Icon
//      leicht getinted) statt `bg-muted` — fühlt sich TikTok-brand-freundlich
//      an, nicht wie ein 404.
//   3. Ring + Shadow-Elevation damit das Icon-Plate leicht „schwebt" statt
//      flach im Dashed-Box zu kleben. Ring-Color inner-weiß (ring-background)
//      + outer-tinted (ring-pink/ring-amber) ist ein Standard-„Halo"-Trick.
//   4. `border-dashed border-border` → weg, stattdessen dezenter
//      `bg-muted/30`-Wash. Dashed-Borders sind ein Legacy-Signal für
//      „Placeholder" und billig.
// -----------------------------------------------------------------------------

type EmptyIcon = 'likes' | 'reposts' | 'shop' | 'battles' | 'lives';

const EMPTY_ICON_MAP: Record<
  EmptyIcon,
  { Icon: typeof Heart; gradient: string; ring: string }
> = {
  likes: {
    Icon: Heart,
    gradient: 'from-pink-500/15 via-rose-500/10 to-red-500/5',
    ring: 'ring-pink-500/20',
  },
  reposts: {
    Icon: Repeat2,
    gradient: 'from-emerald-500/15 via-teal-500/10 to-cyan-500/5',
    ring: 'ring-emerald-500/20',
  },
  shop: {
    Icon: ShoppingBag,
    gradient: 'from-amber-500/15 via-orange-500/10 to-red-500/5',
    ring: 'ring-amber-500/20',
  },
  battles: {
    Icon: Swords,
    gradient: 'from-violet-500/15 via-indigo-500/10 to-sky-500/5',
    ring: 'ring-violet-500/20',
  },
  lives: {
    Icon: Radio,
    gradient: 'from-red-500/15 via-rose-500/10 to-pink-500/5',
    ring: 'ring-red-500/20',
  },
};

function EmptyPanelInfo({
  icon,
  title,
  hint,
}: {
  icon: EmptyIcon;
  title: string;
  hint: string;
}) {
  const { Icon, gradient, ring } = EMPTY_ICON_MAP[icon];
  return (
    <div
      className={`relative flex min-h-[260px] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} bg-card/50 px-6 py-14 text-center`}
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-elevation-2 ring-1 ${ring}`}
      >
        <Icon className="h-8 w-8 text-foreground/80" strokeWidth={1.75} />
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
