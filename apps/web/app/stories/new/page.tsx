import { redirect } from 'next/navigation';

import { getUser } from '@/lib/auth/session';
import { StoryCreator } from '@/components/stories/story-creator';

// -----------------------------------------------------------------------------
// /stories/new — Story-Creator.
//
// Auth-Gate (Middleware + defense-in-depth hier). Der eigentliche Editor ist
// client-seitig — Upload zu R2, optional Text-Overlay (als Data-URL-Composit
// auf Canvas), optionale Poll mit 2 Optionen.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export default async function NewStoryPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/stories/new');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 lg:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Story erstellen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ephemer — deine Story ist 24 Stunden sichtbar und verschwindet danach.
        </p>
      </header>
      <StoryCreator viewerId={user.id} />
    </div>
  );
}
