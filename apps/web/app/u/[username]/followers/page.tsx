import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { getPublicProfile, getProfileFollowers, getViewerFollowingSet } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { FollowUserList } from '@/components/profile/follow-user-list';

// -----------------------------------------------------------------------------
// /u/[username]/followers — Wer folgt diesem Account?
//
// SSR-Seed: erste 50 Follower; danach IntersectionObserver via FollowUserList
// → GET /api/follows/followers?username=X&offset=N.
//
// force-dynamic: Liste ändert sich bei jedem Follow/Unfollow.
//
// v1.w.UI.128 — infinite scroll (vorher: hartes 100er-Limit).
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Follower von @${username} — Serlo`,
    robots: { index: false, follow: false },
  };
}

const SEED = 50;

export default async function FollowersPage({ params }: PageProps) {
  const { username } = await params;

  const [profile, viewer] = await Promise.all([
    getPublicProfile(username),
    getUser(),
  ]);

  if (!profile) notFound();

  const [followers, followingSet] = await Promise.all([
    getProfileFollowers(profile.id, SEED),
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

      <FollowUserList
        mode="followers"
        username={username}
        initialUsers={followers}
        initialHasMore={followers.length >= SEED}
        viewerId={viewer?.id ?? null}
        followingSet={followingSet}
      />
    </main>
  );
}
