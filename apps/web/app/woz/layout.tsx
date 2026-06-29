import type { ReactNode } from 'react';
import { FeedSidebarLayout } from '@/components/feed/feed-sidebar-layout';

// Schmale Serlo-Rail (klappt per Hover auf) auch in der Women-Only Zone —
// damit von hier ein Weg zurück in den Rest der App existiert.
export default function WozLayout({ children }: { children: ReactNode }) {
  return <FeedSidebarLayout railCollapsible>{children}</FeedSidebarLayout>;
}
