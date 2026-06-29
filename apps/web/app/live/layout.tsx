import type { ReactNode } from 'react';
import { getUser } from '@/lib/auth/session';
import { getActiveLiveSessions } from '@/lib/data/live';
import { LiveLayoutShell } from '@/components/live/live-layout-shell';
import type { LiveSidebarSession } from '@/components/live/live-browse-sidebar';
import { FeedSidebarRail } from '@/components/feed/feed-sidebar-rail';

// -----------------------------------------------------------------------------
// /live layout — Server-Component mit Datenfetching.
// Reicht Daten an LiveLayoutShell (Client) weiter, die per usePathname
// entscheidet ob Sidebar oder Fullscreen-Mode.
// -----------------------------------------------------------------------------

export default async function LiveLayout({ children }: { children: ReactNode }) {
  const [user, rawSessions] = await Promise.all([
    getUser(),
    getActiveLiveSessions(30).catch(() => []),
  ]);

  const liveSessions: LiveSidebarSession[] = rawSessions.map((s) => ({
    id: s.id,
    host_id: s.host_id,
    host_username: s.host?.username ?? null,
    host_display_name: s.host?.display_name ?? null,
    host_avatar_url: s.host?.avatar_url ?? null,
    viewer_count: s.viewer_count ?? null,
    title: s.title ?? null,
  }));

  // Schmale Serlo-Rail (xl+) wird nur auf Browse-Seiten gerendert (LiveLayoutShell
  // entscheidet client-seitig via Pathname — Fullscreen-Watch/Host bekommen keine).
  return (
    <LiveLayoutShell
      liveSessions={liveSessions}
      isAuthed={!!user}
      rail={<FeedSidebarRail railCollapsible />}
    >
      {children}
    </LiveLayoutShell>
  );
}
