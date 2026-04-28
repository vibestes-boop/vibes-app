import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getBookmarkedPosts } from '@/lib/data/public';

// v1.w.UI.121 — infinite scroll via /api/saved
import { PostGrid } from '@/components/profile/post-grid';

// -----------------------------------------------------------------------------
// /saved — Gespeicherte Posts des eingeloggten Users.
//
// v1.w.UI.50: Die `PostActionsBar` und `FeedCard` haben einen Bookmark-Button
// der Posts in die `bookmarks`-Tabelle schreibt. Bisher gab es keine Web-Seite
// um diese Posts wieder zu finden. Diese Page schließt diese Lücke.
//
// Nur für eingeloggte User — Redirect zu /login sonst.
// force-dynamic: Inhalt ist 100% per-User, kein ISR sinnvoll.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Gespeichert — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/saved');

  const posts = await getBookmarkedPosts(24);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center gap-2">
        <Bookmark className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Gespeichert</h1>
      </header>

      <PostGrid
        posts={posts}
        emptyTitle="Noch nichts gespeichert"
        emptyDescription="Tippe auf das Lesezeichen-Symbol bei einem Video, um es hier zu speichern."
        emptyIcon={<Bookmark className="h-7 w-7" strokeWidth={1.75} />}
        fetchMoreUrl="/api/saved"
        initialHasMore={posts.length >= 24}
      />
    </div>
  );
}
