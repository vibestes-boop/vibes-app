import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video hochladen — Serlo',
  description: 'Lade ein Video hoch, schreibe einen Post oder plane Inhalte für später.',
  robots: { index: false, follow: false },
};

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { getDraft } from '@/lib/data/posts';
import { CreateEditor } from '@/components/create/create-editor';

// -----------------------------------------------------------------------------
// /create — Upload- und Compose-Flow für Posts.
// - Auth-Gate (Middleware gated bereits, aber defense-in-depth)
// - Optional: `?draftId=…` → Resume-Editing aus `post_drafts`
// - Der eigentliche Editor ist client-seitig (Upload zu R2, Live-Preview,
//   Autocomplete, Privacy-Toggles, Schedule-Modal).
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ draftId?: string }>;
}

export default async function CreatePage({ searchParams }: PageProps) {
  const user = await getUser();
  if (!user) redirect('/login?next=/create');

  const { draftId } = await searchParams;
  const draft = draftId ? await getDraft(draftId) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 lg:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Post erstellen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Video oder Bild hochladen, Caption schreiben, veröffentlichen oder planen.
          </p>
        </div>
      </header>

      <CreateEditor
        viewerId={user.id}
        initialDraft={
          draft
            ? {
                id: draft.id,
                caption: draft.caption ?? '',
                tags: draft.tags ?? [],
                mediaUrl: draft.media_url,
                mediaType: draft.media_type,
                thumbnailUrl: draft.thumbnail_url,
                settings: draft.settings ?? {},
              }
            : null
        }
      />
    </div>
  );
}
