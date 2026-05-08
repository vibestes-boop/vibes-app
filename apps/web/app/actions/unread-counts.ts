'use server';

import { createClient } from '@/lib/supabase/server';

export interface UnreadShellCounts {
  dms: number;
  notifications: number;
}

interface UnreadShellCountsRow {
  unread_dms: number | string | null;
  unread_notifications: number | string | null;
}

const EMPTY_COUNTS: UnreadShellCounts = {
  dms: 0,
  notifications: 0,
};

function toCount(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getUnreadShellCounts(): Promise<UnreadShellCounts> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_COUNTS;

  const { data, error } = await supabase
    .rpc('get_unread_shell_counts')
    .single();

  if (error || !data) return EMPTY_COUNTS;

  const row = data as UnreadShellCountsRow;

  return {
    dms: toCount(row.unread_dms),
    notifications: toCount(row.unread_notifications),
  };
}
