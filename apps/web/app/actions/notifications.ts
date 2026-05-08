'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUnreadShellCounts } from '@/app/actions/unread-counts';

// getUnreadNotificationCount — als Server Action für Client-Components (useQuery).
// Wrapper um den Data-Layer damit Client-Components ihn direkt aufrufen können.
export async function getUnreadNotificationCount(): Promise<number> {
  const counts = await getUnreadShellCounts();
  return counts.notifications;
}

// -----------------------------------------------------------------------------
// Notifications Server Actions — v1.w.UI.38
// -----------------------------------------------------------------------------

// markAllNotificationsRead — Alle ungelesenen Notifications des eingeloggten
// Users als gelesen markieren. Wird beim Öffnen der /notifications-Seite
// aufgerufen (Client-Component via useEffect, einmalig).
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', user.id)
    .eq('read', false);

  // Sidebar-Badge + Page neu validieren
  revalidatePath('/notifications');
}
