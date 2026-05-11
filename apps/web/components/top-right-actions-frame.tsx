'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function TopRightActionsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideOnLiveHost = pathname?.startsWith('/live/host');

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-2',
        hideOnLiveHost && 'hidden',
      )}
    >
      {children}
    </div>
  );
}
