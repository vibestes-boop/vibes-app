import type { ReactNode } from 'react';
import { FeedShell } from '@/components/feed/feed-shell';

// Desktop-Sidebar-Shell → siehe components/feed/feed-shell.tsx (geteilt).
export default function GuildsLayout({ children }: { children: ReactNode }) {
  return <FeedShell>{children}</FeedShell>;
}
