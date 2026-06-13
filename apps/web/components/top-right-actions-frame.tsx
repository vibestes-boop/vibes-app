'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function TopRightActionsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Live-Host: eigene Vollbild-UI. Admin: eigener Header mit Suche/Bell/Avatar —
  // die floatenden Consumer-Pills würden dessen Controls oben rechts verdecken.
  const hide =
    pathname?.startsWith('/live/host') || pathname?.startsWith('/admin');

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-2',
        hide && 'hidden',
      )}
    >
      {children}
    </div>
  );
}
