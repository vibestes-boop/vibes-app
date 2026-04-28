import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPublicProfile, getProfileFollowers, getViewerFollowingSet } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { FollowButton } from '@/components/profile/follow-button';

// -----------------------------------------------------------------------------
// /u/[username]/followers — Wer folgt diesem Account?
//
// ISR: force-dynamic — Liste ändert sich bei jedem Follow/Unfollow.
// FollowButton ist Client-Komponente, rendert direkt aus RSC.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Follower von @${username} — Serlo`,
    robots: { index: false, follow: false }, // Listen-Pages nicht indexieren
  };
}

export default async function FollowersPage({ params }: PageProps) {
  const { username } = await params;

  const [profile, viewer] = await Promise.all([
    getPublicProfile(username),
    getUser(),
  ]);

  if (!profile) notFound();

  const [followers, followingSet] = await Promise.all([
    getProfileFollowers(profile.id, 100),
    getViewerFollowingSet(),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6">
      {/* Header */}
      <header className="mb-6">
        <Link
          href={`/u/${username}` as Route}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          @{username}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-brand-gold" />
          Follower
          <span className="ml-1 text-lg font-normal text-muted-foreground">
            ({profile.follower_count.toLocaleString('de-DE')})
          </span>
        </h1>
      </header>

      {followers.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Noch keine Follower.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {followers.map((u) => {
            const isSelf = viewer?.id === u.id;
            return (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <Link href={`/u/${u.username}` as Route} className="shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={u.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-sm">
                      {(u.display_name ?? u.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${u.username}` as Route}
                    className="block hover:underline underline-offset-4"
                  >
                    <div className="flex items-center gap-1 truncate text-sm font-semibold">
                      {u.display_name ?? u.username}
                      {u.verified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      @{u.username}
                    </div>
                  </Link>
                </div>

                {!isSelf && (
                  <FollowButton
                    isAuthenticated={!!viewer}
                    isFollowing={followingSet.has(u.id)}
                    isSelf={false}
                    username={u.username}
                    targetUserId={u.id}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
