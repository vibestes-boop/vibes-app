import { getUser } from '@/lib/auth/session';
import { getMyFollowedAccounts } from '@/lib/data/feed';
import { createClient } from '@/lib/supabase/server';
import { FeedSidebar } from '@/components/feed/feed-sidebar';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// FeedSidebarRail — die linke Serlo-Navigation als eigenständige <aside>.
// Holt dieselben Daten wie FeedSidebarLayout (Profil für Avatar-Button, Follows
// für „Konten, denen ich folge") und rendert die FeedSidebar.
//
// Ausgelagert aus FeedSidebarLayout, damit Seiten mit eigenem Layout-Modell
// (z. B. /live mit Fullscreen-Branch oder /admin mit fixed-Sidebar) die Rail
// einzeln einhängen können, ohne den Daten-Fetch zu duplizieren.
// -----------------------------------------------------------------------------

export async function FeedSidebarRail({
  railCollapsible = false,
  className,
}: {
  /** Schmale Icon-Rail, die per Hover-Overlay aufklappt (w-20 → w-[260px]). */
  railCollapsible?: boolean;
  /** Zusätzliche Klassen für die <aside> (z. B. `fixed` für /admin). */
  className?: string;
}) {
  const user = await getUser();
  const viewerId = user?.id ?? null;

  const [followedAccounts, profileRow] = await Promise.all([
    viewerId
      ? getMyFollowedAccounts({ limit: 5 }).catch(() => [] as import('@/lib/data/feed').FollowedAccount[])
      : Promise.resolve(undefined),
    viewerId
      ? (async () => {
          const supabase = await createClient();
          const { data } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url, is_admin')
            .eq('id', viewerId)
            .maybeSingle();
          return data as { username: string | null; display_name: string | null; avatar_url: string | null; is_admin?: boolean } | null;
        })().catch(() => null)
      : Promise.resolve(null),
  ]);

  const viewerIsAdmin = Boolean(profileRow?.is_admin);
  const viewerProfile = profileRow
    ? { username: profileRow.username, display_name: profileRow.display_name, avatar_url: profileRow.avatar_url }
    : null;

  return (
    <aside
      className={cn(
        // Nur auf xl+ sichtbar. railCollapsible: schmale Rail (w-20), die per
        // Hover-Overlay aufklappt (border/bg trägt dann die Sidebar selbst).
        'hidden shrink-0 xl:block',
        railCollapsible ? 'w-20' : 'w-[260px] border-r border-border',
        className,
      )}
    >
      <FeedSidebar
        viewerId={viewerId}
        viewerProfile={viewerProfile}
        followedAccounts={followedAccounts}
        viewerIsAdmin={viewerIsAdmin}
        railCollapsible={railCollapsible}
      />
    </aside>
  );
}
