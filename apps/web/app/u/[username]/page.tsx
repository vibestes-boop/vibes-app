import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, Construction } from 'lucide-react';

import { getPublicProfile, getProfilePosts, isFollowing } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { getMyCoinBalance } from '@/lib/data/payments';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PostGrid } from '@/components/profile/post-grid';
import { ProfileTabs, type ProfileTab } from '@/components/profile/profile-tabs';
import { FollowButton } from '@/components/profile/follow-button';
import { CreatorTipButton } from '@/components/profile/creator-tip-button';

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
  const profile = await getPublicProfile(username);

  if (!profile) {
    return {
      title: '@' + username + ' nicht gefunden',
      robots: { index: false, follow: false },
    };
  }

  const displayName = profile.display_name ?? `@${profile.username}`;
  const description =
    profile.bio?.slice(0, 160) ??
    `${displayName} auf Serlo — ${profile.follower_count.toLocaleString('de-DE')} Follower.`;

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
// -----------------------------------------------------------------------------

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-semibold tabular-nums">
        {value.toLocaleString('de-DE')}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, { tab: tabParam }] = await Promise.all([params, searchParams]);

  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  // Canonical redirect: /u/zAuR → /u/zaur (nur Komfort, 404 bleibt 404).
  // Wir rendern hier einfach mit dem normalisierten username, weil getPublicProfile
  // bereits lowercase-matcht — keine Redirect-Loop-Gefahr.

  const tab: ProfileTab =
    tabParam === 'likes' || tabParam === 'shop' || tabParam === 'battles'
      ? tabParam
      : 'posts';

  // Parallel: Session + Follow-Status + Posts-Feed + Coin-Balance
  const [viewer, alreadyFollowing, posts, balance] = await Promise.all([
    getUser(),
    isFollowing(profile.id),
    tab === 'posts' ? getProfilePosts(profile.id, 24) : Promise.resolve([]),
    getMyCoinBalance(),
  ]);

  const isSelf = viewer?.id === profile.id;
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
          <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-4 ring-background">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback className="text-2xl">
              {(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-2xl font-semibold leading-none tracking-tight">
                {displayName}
              </h1>
              {profile.verified && (
                <BadgeCheck
                  className="h-5 w-5 fill-brand-gold text-background"
                  aria-label="Verifiziert"
                />
              )}
            </div>

            <div className="text-sm text-muted-foreground">@{profile.username}</div>

            <div className="flex items-center gap-6 pt-1">
              {/* Phase 3 bringt /u/[username]/followers + /following als eigene Routen.
                  Bis dahin sind die Stat-Pills reine Display-Elemente — kein Link. */}
              <StatPill label="Posts"    value={profile.post_count} />
              <StatPill label="Follower" value={profile.follower_count} />
              <StatPill label="Folgt"    value={profile.following_count} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:self-start">
            <FollowButton
              isAuthenticated={!!viewer}
              isFollowing={alreadyFollowing}
              isSelf={isSelf}
              username={profile.username}
            />
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
            {profile.bio}
          </p>
        )}
      </section>

      {/* ───── Tab-Navigation ───── */}
      <ProfileTabs
        active={tab}
        counts={{
          posts: profile.post_count,
        }}
      />

      {/* ───── Panels ───── */}
      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="px-2 py-4 sm:px-3"
      >
        {tab === 'posts' && (
          <PostGrid
            posts={posts}
            emptyHint={
              isSelf
                ? 'Deine Videos erscheinen hier — lade dein erstes Video in der App hoch.'
                : `@${profile.username} hat noch keine öffentlichen Videos.`
            }
          />
        )}

        {tab === 'likes' && (
          <EmptyPanelInfo
            title="Gelikte Videos sind privat"
            hint={
              isSelf
                ? 'Nur du siehst deine Like-Historie — und aktuell nur in der App.'
                : 'Likes sind privat — nur der Account-Inhaber selbst kann sie sehen.'
            }
          />
        )}

        {tab === 'shop' && (
          <EmptyPanelInfo
            title="Shop kommt in Phase 4"
            hint="Storefront, Sale-Management und Checkout laufen gerade im Build."
          />
        )}

        {tab === 'battles' && (
          <EmptyPanelInfo
            title="Live-Battles sind in der App"
            hint="Battle-History und Replays landen mit Phase 6 im Web."
          />
        )}
      </section>
    </main>
  );
}

function EmptyPanelInfo({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Construction className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
