import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getUser } from '@/lib/auth/session';
import { getSuggestedFollows } from '@/lib/data/feed';
import { FollowStep } from '@/components/onboarding/follow-step';

export const dynamic = 'force-dynamic'; // never cache — follows must be fresh.
export const metadata = { title: 'Accounts entdecken' };

export default async function OnboardingFollowPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/';

  // Auth gate — if somehow reached without being logged in.
  const user = await getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/onboarding/follow')}` as Route);
  }

  // Fetch up to 12 suggestions (filters already-followed + self server-side).
  const suggested = await getSuggestedFollows(12);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <FollowStep
          suggested={suggested}
          next={next}
          isAuthenticated={true}
        />
      </div>
    </main>
  );
}
