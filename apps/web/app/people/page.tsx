import type { Metadata } from 'next';
import { Users } from 'lucide-react';

import { getSuggestedFollowsPage, PEOPLE_PAGE_LIMIT } from '@/lib/data/feed';
import { getUser } from '@/lib/auth/session';
import { PeopleList } from '@/components/people/people-list';

// -----------------------------------------------------------------------------
// /people — Accounts entdecken.
//
// Dedizierte Entdeckungs-Seite für User-Discovery (TikTok „For You"-People).
// SSR: erste 24 Accounts (nach follower_count DESC, exkl. Self + bereits Gefolgte).
// Client: IntersectionObserver infinite scroll via PeopleList.
//
// v1.w.UI.120 — ersetzt das statische 12-Karten-Grid auf /explore.
// /explore verlinkt jetzt mit „Alle ansehen →" hierher.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Accounts entdecken — Serlo',
  description: 'Entdecke neue Accounts auf Serlo und finde interessante Creator.',
  alternates: { canonical: '/people' },
};

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const [{ people, hasMore }, viewer] = await Promise.all([
    getSuggestedFollowsPage(0, PEOPLE_PAGE_LIMIT),
    getUser(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center gap-2">
        <Users className="h-6 w-6 text-brand-gold" />
        <h1 className="text-2xl font-semibold tracking-tight">Accounts entdecken</h1>
      </header>

      <PeopleList
        initialPeople={people}
        initialHasMore={hasMore}
        viewerId={viewer?.id ?? null}
      />
    </div>
  );
}
