import type { ReactNode } from 'react';
import { FeedShell } from '@/components/feed/feed-shell';
import './discover.css';

// Desktop-Sidebar-Shell → siehe components/feed/feed-shell.tsx (geteilt).
export default function ExploreLayout({ children }: { children: ReactNode }) {
  return <div className="serlo-discover-shell"><FeedShell>{children}</FeedShell></div>;
}
