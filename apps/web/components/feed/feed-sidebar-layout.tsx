import type { ReactNode } from 'react';
import { FeedSidebarRail } from '@/components/feed/feed-sidebar-rail';

// -----------------------------------------------------------------------------
// FeedSidebarLayout — geteiltes Server-Layout: persistente FeedSidebar auf
// Desktop (xl+) + Main-Content. Der Daten-Fetch + die <aside> leben in
// FeedSidebarRail (wiederverwendbar für Seiten mit eigenem Layout-Modell).
// Verwendung: in app/<route>/layout.tsx einfach durchreichen.
// -----------------------------------------------------------------------------

export async function FeedSidebarLayout({
  children,
  railCollapsible = false,
}: {
  children: ReactNode;
  /** Schmale Icon-Rail, die beim Hover aufklappt — für Seiten mit eigener
   *  zweiter Sidebar (Shop-Katalog), damit nicht zwei breite Sidebars kollidieren. */
  railCollapsible?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px]">
      <FeedSidebarRail railCollapsible={railCollapsible} />

      {/* Main Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
