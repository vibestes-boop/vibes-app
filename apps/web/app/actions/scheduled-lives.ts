'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';
import type { ActionResult } from './profile';

// -----------------------------------------------------------------------------
// scheduled-lives.ts — v1.w.UI.155
//
// Server-Actions für /studio/live (Creator) und /live (public):
//
//   scheduleLive(formData)   — RPC `schedule_live`, revalidate
//   cancelScheduledLive(id)  — RPC `cancel_scheduled_live`, revalidate
//
// Parität zu mobile `useScheduledLives` Hook (lib/useScheduledLives.ts).
// Die RPCs haben SECURITY DEFINER + host-id-Guard — nur der eigene User kann
// seine eigenen Scheduled-Lives verwalten.
// -----------------------------------------------------------------------------

export async function scheduleLive(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const title       = (formData.get('title') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim() || null;
  const scheduledAt = formData.get('scheduled_at') as string | null;

  if (!title || title.length < 3) {
    return { ok: false, error: 'Titel muss mindestens 3 Zeichen lang sein.', field: 'title' };
  }
  if (title.length > 80) {
    return { ok: false, error: 'Titel darf maximal 80 Zeichen lang sein.', field: 'title' };
  }
  if (!scheduledAt) {
    return { ok: false, error: 'Startzeit fehlt.', field: 'scheduled_at' };
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    return { ok: false, error: 'Ungültiges Datum.', field: 'scheduled_at' };
  }
  if (scheduledDate.getTime() < Date.now() + 5 * 60_000) {
    return { ok: false, error: 'Startzeit muss mindestens 5 Minuten in der Zukunft liegen.', field: 'scheduled_at' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('schedule_live', {
    p_scheduled_at:   scheduledDate.toISOString(),
    p_title:          title,
    p_description:    description,
    p_allow_comments: true,
    p_allow_gifts:    true,
    p_women_only:     false,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/studio/live');
  revalidatePath('/live');
  return { ok: true, data: { id: data as string } };
}

export async function cancelScheduledLive(id: string): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_scheduled_live', { p_id: id });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/studio/live');
  revalidatePath('/live');
  return { ok: true, data: null };
}
