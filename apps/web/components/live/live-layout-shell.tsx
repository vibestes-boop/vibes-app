'use client';

import { usePathname } from 'next/navigation';
import { LiveBrowseSidebar, type LiveSidebarSession } from './live-browse-sidebar';

// -----------------------------------------------------------------------------
// LiveLayoutShell — Client-Wrapper für das /live Layout.
//
// Watch-Pages (/live/[id]) und Host-Pages (/live/host/[id]) sind fullscreen
// → dort wird nur children gerendert, keine Sidebar.
// Browse-Pages (/live, /live/replays, /live/start) bekommen die Live-Sidebar.
// -----------------------------------------------------------------------------

const FULLSCREEN_PATTERNS = [
  /^\/live\/host\//,
  /^\/live\/replay\//,
  /^\/live\/[^/]+$/,   // /live/[id] — Watch-Page (kein weiterer Slash)
];

function isFullscreen(pathname: string): boolean {
  return FULLSCREEN_PATTERNS.some((re) => re.test(pathname));
}

interface LiveLayoutShellProps {
  children: React.ReactNode;
  liveSessions: LiveSidebarSession[];
  isAuthed: boolean;
}

export function LiveLayoutShell({ children, liveSessions, isAuthed }: LiveLayoutShellProps) {
  const pathname = usePathname();

  if (isFullscreen(pathname)) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px]">
      {/* Live-spezifische Sidebar — nur auf xl+, nur auf Browse-Pages */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border xl:block">
        <LiveBrowseSidebar liveSessions={liveSessions} isAuthed={isAuthed} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
