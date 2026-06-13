import type { ReactNode } from 'react';
import { getUser } from '@/lib/auth/session';
import { getActiveLiveSessions } from '@/lib/data/live';
import { LiveLayoutShell } from '@/components/live/live-layout-shell';
import type { LiveSidebarSession } from '@/components/live/live-browse-sidebar';

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

  return (
    <LiveLayoutShell liveSessions={liveSessions} isAuthed={!!user}>
      {children}
    </LiveLayoutShell>
  );
}
