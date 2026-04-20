import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getStoryGroupForUser, getActiveStoryGroups } from '@/lib/data/stories';
import { createClient } from '@/lib/supabase/server';
import { StoryViewer } from '@/components/stories/story-viewer';

// -----------------------------------------------------------------------------
// /stories/[userId] — Story-Viewer für einen bestimmten User.
//
// Scope: eingeloggte User. Anons werden zum Login redirected (`next=` gesetzt
// damit sie nach Login direkt zurück in den Viewer fallen).
//
// Wir holen zusätzlich ALLE Story-Groups damit der Viewer zwischen Usern
// navigieren kann (links → vorherige Gruppe, rechts → nächste Gruppe). Die
// Nav-Reihenfolge folgt derselben Sortierung wie im Feed-Strip.
//
// Dynamic: Viewer hängt am Auth-State + 24h-TTL → kein ISR.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

// Dynamische Metadata: wir holen die Story-Group für den User, damit der
// Share-Link (z.B. in einem DM verschickt) eine sinnvolle Social-Preview
// bekommt. Viewer bleibt noindex — das ist ein eingeloggtes Surface.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const group = await getStoryGroupForUser(userId).catch(() => null);

  if (!group) {
    return {
      title: 'Stories — Serlo',
      robots: { index: false, follow: false },
    };
  }

  const authorName = group.username ? `@${group.username}` : 'einem User';
  const title = `Stories von ${authorName}`;
  const description = `Aktuelle Stories von ${authorName} auf Serlo. Nur 24 Stunden sichtbar.`;
  // Thumbnail = erste Bild-Story falls vorhanden (Viewer-First-Frame)
  const firstImage = group.stories.find((s) => s.media_type === 'image')?.media_url;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'article',
      title,
      description,
      siteName: 'Serlo',
      images: firstImage ? [{ url: firstImage }] : undefined,
    },
    twitter: {
      card: firstImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: firstImage ? [firstImage] : undefined,
    },
  };
}

export default async function StoryViewerPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/stories/${encodeURIComponent(userId)}`);
  }

  const [group, allGroups] = await Promise.all([
    getStoryGroupForUser(userId),
    getActiveStoryGroups(),
  ]);

  if (!group) notFound();

  // Prev/Next-User für Carousel-Navigation
  const userOrder = allGroups.map((g) => g.userId);
  const currentIdx = userOrder.indexOf(userId);
  const prevUserId = currentIdx > 0 ? userOrder[currentIdx - 1] : null;
  const nextUserId =
    currentIdx >= 0 && currentIdx < userOrder.length - 1 ? userOrder[currentIdx + 1] : null;

  return (
    <StoryViewer
      group={group}
      prevUserId={prevUserId}
      nextUserId={nextUserId}
      viewerUserId={user.id}
    />
  );
}
