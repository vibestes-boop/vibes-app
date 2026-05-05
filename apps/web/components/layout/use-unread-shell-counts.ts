'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getUnreadShellCounts,
  type UnreadShellCounts,
} from '@/app/actions/unread-counts';

const EMPTY_COUNTS: UnreadShellCounts = {
  dms: 0,
  notifications: 0,
};

export function useUnreadShellCounts(
  viewerId: string | null,
  initialCounts: UnreadShellCounts = EMPTY_COUNTS,
) {
  const [afterFirstPaint, setAfterFirstPaint] = useState(false);

  useEffect(() => {
    if (!viewerId) {
      setAfterFirstPaint(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setAfterFirstPaint(true);
    }, 1_500);

    return () => window.clearTimeout(timeout);
  }, [viewerId]);

  return useQuery({
    queryKey: ['unread-shell-counts'],
    queryFn: () => getUnreadShellCounts(),
    enabled: Boolean(viewerId) && afterFirstPaint,
    initialData: initialCounts,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
  });
}
