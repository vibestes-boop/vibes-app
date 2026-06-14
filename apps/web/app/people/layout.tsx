import type { ReactNode } from 'react';
import { FeedShell } from '@/components/feed/feed-shell';

// Desktop-Sidebar-Shell → siehe components/feed/feed-shell.tsx (geteilt).
export default function PeopleLayout({ children }: { children: ReactNode }) {
  return <FeedShell>{children}</FeedShell>;
}
