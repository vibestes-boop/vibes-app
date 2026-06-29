import type { ReactNode } from 'react';
import { FeedSidebarLayout } from '@/components/feed/feed-sidebar-layout';

// Schmale Serlo-Rail (klappt per Hover auf) auch auf der Datenschutz-Seite.
export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return <FeedSidebarLayout railCollapsible>{children}</FeedSidebarLayout>;
}
