import type { ReactNode } from 'react';
import { getUser } from '@/lib/auth/session';
import { getMyFollowedAccounts } from '@/lib/data/feed';
import { createClient } from '@/lib/supabase/server';
import { FeedSidebar } from '@/components/feed/feed-sidebar';

// -----------------------------------------------------------------------------
// /people layout — Accounts-entdecken-Seite mit persistenter FeedSidebar auf
// Desktop (xl+). Identisches Sidebar-Pattern wie /explore und /u layout.
//
// Fix: /people hatte vorher kein layout.tsx → keine FeedSidebar (nur die
// Root-Layout-Topnav) → wirkte „ohne Sidebar / leer". Dieses Layout zieht die
// gleiche Shell wie die übrigen Discovery-Seiten.
// -----------------------------------------------------------------------------

export default async function PeopleLayout({ children }: { children: ReactNode }) {
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
  const viewerProfile = profileRow ? { username: profileRow.username, display_name: profileRow.display_name, avatar_url: profileRow.avatar_url } : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px]">
      {/* Left Sidebar — nur auf xl+ sichtbar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border xl:block">
        <FeedSidebar
          viewerId={viewerId}
          viewerProfile={viewerProfile}
          followedAccounts={followedAccounts}
          viewerIsAdmin={viewerIsAdmin}
        />
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
