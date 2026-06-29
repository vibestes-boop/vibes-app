import type { ReactNode } from 'react';
import { FeedSidebarLayout } from '@/components/feed/feed-sidebar-layout';

// Schmale Serlo-Rail (klappt per Hover auf) auch im Coin-Shop.
export default function CoinShopLayout({ children }: { children: ReactNode }) {
  return <FeedSidebarLayout railCollapsible>{children}</FeedSidebarLayout>;
}
