import type { ReactNode } from 'react';
import { FeedSidebarLayout } from '@/components/feed/feed-sidebar-layout';

// /search mit persistenter FeedSidebar — die Sidebar-Suche pusht hierher,
// ohne Sidebar wäre das eine Navigations-Sackgasse.

export default function SearchLayout({ children }: { children: ReactNode }) {
  return <FeedSidebarLayout>{children}</FeedSidebarLayout>;
}
