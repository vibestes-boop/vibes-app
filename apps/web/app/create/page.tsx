import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Video hochladen — Serlo',
  description: 'Lade ein Video hoch, schreibe einen Post oder plane Inhalte für später.',
  robots: { index: false, follow: false },
};

import { redirect } from 'next/navigation';
import { hasSupabaseAuthCookie } from '@/lib/auth/cookies';
import { getUser } from '@/lib/auth/session';
import { getDraft } from '@/lib/data/posts';
import { getMyProducts } from '@/lib/data/shop';
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
  const hasAuthCookie = await hasSupabaseAuthCookie();
  const user = hasAuthCookie ? await getUser() : null;
  const { draftId } = await searchParams;
  if (!user) {
    const next = draftId ? `/create?${new URLSearchParams({ draftId })}` : '/create';
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const [draft, myProducts] = await Promise.all([
    draftId ? getDraft(draftId) : Promise.resolve(null),
    getMyProducts().catch(() => []),
  ]);
  // Shoppable Posts (#2): nur aktive eigene Produkte zum Verknüpfen anbieten.
  const linkableProducts = myProducts
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, title: p.title, cover_url: p.cover_url ?? null }));

  return (
    <div className="serlo-create-page mx-auto w-full max-w-5xl px-4 pb-12 pt-6 lg:px-6">
      <header className="mb-6 flex items-start gap-3">
        <Link href="/explore" aria-label="Zurück zu Entdecken" className="serlo-glass-button grid h-11 w-11 shrink-0 place-items-center rounded-full"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-semibold">Post erstellen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Video oder Bild hochladen, Caption schreiben, veröffentlichen oder planen.
          </p>
        </div>
      </header>

      <CreateEditor
        viewerId={user.id}
        products={linkableProducts}
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
