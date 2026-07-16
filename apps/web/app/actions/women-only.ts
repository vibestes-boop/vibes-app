'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';

// -----------------------------------------------------------------------------
// Women-Only Zone — Zugang seit 16.7.2026 geprüft (WOZ-Audit Gap 3):
// Selbstdeklaration → Antrag → Admin-Freigabe. Der Client kann
// `women_only_verified` NICHT mehr direkt setzen (DB-Trigger sperrt die Spalte);
// alles läuft über SECURITY-DEFINER-RPCs. Parität zu lib/useWomenOnly.ts.
// -----------------------------------------------------------------------------

// requestWomenOnlyZone — Zugang beantragen (Selbstdeklaration). Legt einen
// pending-Antrag an, GEWÄHRT ABER KEINEN ZUGANG bis zur Admin-Freigabe.
export async function requestWomenOnlyZone(): Promise<{ error: string | null; status?: string }> {
  const user = await getUser();
  if (!user) return { error: 'not_authenticated' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_women_only');
  if (error) return { error: error.message };
  const res = data as { success?: boolean; status?: string; error?: string } | null;
  if (!res?.success) return { error: res?.error ?? 'network_error' };

  revalidatePath('/women-only');
  revalidatePath('/woz');
  return { error: null, status: res.status };
}

// leaveWomenOnlyZone — freiwilliger Austritt (kein Admin-Aberkennen).
export async function leaveWomenOnlyZone(): Promise<{ error: string | null }> {
  const user = await getUser();
  if (!user) return { error: 'not_authenticated' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('leave_women_only');
  if (error) return { error: error.message };
  if (!(data as { success?: boolean } | null)?.success) return { error: 'network_error' };

  revalidatePath('/women-only');
  revalidatePath('/woz');
  return { error: null };
}

// getMyWomenOnlyStatus — Antrags-Status für die UI (none/pending/approved/…).
export async function getMyWomenOnlyStatus(): Promise<{ status: string; verified: boolean }> {
  const user = await getUser();
  if (!user) return { status: 'none', verified: false };
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_my_women_only_status');
  const res = data as { status?: string; verified?: boolean } | null;
  return { status: res?.status ?? 'none', verified: !!res?.verified };
}
