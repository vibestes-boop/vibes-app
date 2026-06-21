import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { getConversations } from '@/lib/data/messages';
import { getActiveStoryGroups } from '@/lib/data/stories';
import { getActiveLiveSessions } from '@/lib/data/live';
import { getMyFollowedAccounts } from '@/lib/data/feed';
import { createClient } from '@/lib/supabase/server';
import { FeedSidebar } from '@/components/feed/feed-sidebar';
import { ConversationListPanel } from '@/components/messages/conversation-list-panel';

// -----------------------------------------------------------------------------
// /messages layout — Short-Video-Style 3-Panel-Layout auf Desktop.
//
// Panels:
//   1. FeedSidebar (260px, xl+) — globale Navigation
//   2. ConversationListPanel (320px, md+) — Konversationsliste
//   3. children — aktiver Chat-Thread (oder Empty-State auf /messages)
//
// Mobile: nur children (Liste = /messages page, Thread = /messages/[id] page).
// -----------------------------------------------------------------------------

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/messages');

  const [conversations, storyGroups, liveSessions, followedAccounts, profileRow] =
    await Promise.all([
      getConversations(),
      getActiveStoryGroups(),
      getActiveLiveSessions(20),
      getMyFollowedAccounts({ limit: 5 }).catch(() => [] as import('@/lib/data/feed').FollowedAccount[]),
      (async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, is_admin')
          .eq('id', user.id)
          .maybeSingle();
        return data as { username: string | null; display_name: string | null; avatar_url: string | null; is_admin?: boolean } | null;
      })().catch(() => null),
    ]);

  const viewerIsAdmin = Boolean(profileRow?.is_admin);
  const viewerProfile = profileRow ? { username: profileRow.username, display_name: profileRow.display_name, avatar_url: profileRow.avatar_url } : null;

  const storyByUserId = new Map(storyGroups.map((g) => [g.userId, g]));
  const liveByUserId = new Map(liveSessions.map((s) => [s.host_id, s.id]));

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Panel 1: FeedSidebar — globale Nav, nur auf xl+ */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border xl:flex xl:flex-col">
        <FeedSidebar
          viewerId={user.id}
          viewerProfile={viewerProfile}
          followedAccounts={followedAccounts}
          viewerIsAdmin={viewerIsAdmin}
        />
      </aside>

      {/* Panel 2: Conversation List — auf md+ sichtbar */}
      <aside className="hidden w-[320px] shrink-0 border-r border-border md:flex md:flex-col">
        <ConversationListPanel
          conversations={conversations}
          liveByUserId={liveByUserId}
          storyByUserId={storyByUserId}
        />
      </aside>

      {/* Panel 3: Thread / Empty-State */}
      <main className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
