'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { isFocusedPage, usesMediaChrome } from '@/lib/navigation-chrome';
import { cn } from '@/lib/utils';

export function TopRightActionsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Live-Host: eigene Vollbild-UI. Admin: eigener Header mit Suche/Bell/Avatar —
  // die floatenden Consumer-Pills würden dessen Controls oben rechts verdecken.
  const hide =
    isFocusedPage(pathname) || pathname === '/messages';

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-2',
        hide && 'hidden',
        !usesMediaChrome(pathname) && 'serlo-account-actions',
        pathname === '/explore' && 'discover-auth-actions',
      )}
    >
      {children}
    </div>
  );
}
