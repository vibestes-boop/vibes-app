import type { ReactNode } from 'react';
import { FeedSidebarLayout } from '@/components/feed/feed-sidebar-layout';

// /shop (inkl. [id], orders, saved) mit persistenter FeedSidebar auf xl+ —
// vorher gab es hier nur die Filter-Spalte ohne Weg zurück zum Feed.

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <FeedSidebarLayout>{children}</FeedSidebarLayout>;
}
