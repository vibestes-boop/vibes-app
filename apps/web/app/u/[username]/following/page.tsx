import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { getPublicProfile, getProfileFollowing, getViewerFollowingSet } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { FollowUserList } from '@/components/profile/follow-user-list';

// -----------------------------------------------------------------------------
// /u/[username]/following — Wem folgt dieser Account?
//
// SSR-Seed: erste 50 Accounts; danach IntersectionObserver via FollowUserList
// → GET /api/follows/following?username=X&offset=N.
//
// force-dynamic: Follow-Status ist auth-abhängig.
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
    title: `@${username} folgt — Serlo`,
    robots: { index: false, follow: false },
  };
}

const SEED = 50;

export default async function FollowingPage({ params }: PageProps) {
  const { username } = await params;

  const [profile, viewer] = await Promise.all([
    getPublicProfile(username),
    getUser(),
  ]);

  if (!profile) notFound();

  const [following, followingSet] = await Promise.all([
    getProfileFollowing(profile.id, SEED),
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
          <UserCheck className="h-6 w-6 text-brand-gold" />
          Folgt
          <span className="ml-1 text-lg font-normal text-muted-foreground">
            ({profile.following_count.toLocaleString('de-DE')})
          </span>
        </h1>
      </header>

      <FollowUserList
        mode="following"
        username={username}
        initialUsers={following}
        initialHasMore={following.length >= SEED}
        viewerId={viewer?.id ?? null}
        followingSet={followingSet}
      />
    </main>
  );
}
