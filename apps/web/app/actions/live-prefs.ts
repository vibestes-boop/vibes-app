'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';
import type { ActionResult } from './profile';

// -----------------------------------------------------------------------------
// live-prefs.ts — v1.w.UI.153 + v1.w.UI.154
//
// Server-Actions für zwei Live-bezogene Settings-Seiten:
//
//   1. Muted Live Hosts (`muted_live_hosts`)
//      getMutedLiveHosts() — Liste für /settings/muted-live-hosts
//      unmuteHost(hostId) — Eintrag löschen → revalidate
//
//   2. CoHost Blocks (`live_cohost_blocks`)
//      getCoHostBlocks() — Liste für /settings/cohost-blocks
//      unblockCoHost(userId) — RPC `unblock_cohost` aufrufen → revalidate
//
// Beide Pages sind `force-dynamic` Server Components; die Actions hier
// liefern reine Daten bzw. mutieren und revalidieren. Kein Client-State
// nötig — router.refresh() in den Button-Komponenten reicht.
// -----------------------------------------------------------------------------

// ─── Muted Live Hosts ────────────────────────────────────────────────────────

export interface MutedHostRow {
  host_id:    string;
  muted_at:   string;
  username:   string | null;
  avatar_url: string | null;
}

export async function getMutedLiveHosts(): Promise<MutedHostRow[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('muted_live_hosts')
    .select(`
      host_id,
      created_at,
      host:profiles!muted_live_hosts_host_id_fkey (
        username,
        avatar_url
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => ({
    host_id:    r.host_id,
    muted_at:   r.created_at,
    username:   r.host?.username   ?? null,
    avatar_url: r.host?.avatar_url ?? null,
  }));
}

export async function unmuteHost(hostId: string): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('muted_live_hosts')
    .delete()
    .eq('user_id', user.id)
    .eq('host_id', hostId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/muted-live-hosts');
  return { ok: true, data: null };
}

// ─── CoHost Blocks ───────────────────────────────────────────────────────────

export interface CoHostBlockRow {
  blocked_user_id: string;
  blocked_at:      string;
  expires_at:      string | null;
  reason:          string | null;
  username:        string | null;
  avatar_url:      string | null;
}

export async function getCoHostBlocks(): Promise<CoHostBlockRow[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('live_cohost_blocks')
    .select(`
      blocked_user_id,
      created_at,
      expires_at,
      reason,
      profile:profiles!live_cohost_blocks_blocked_user_id_fkey (
        username,
        avatar_url
      )
    `)
    .eq('host_id', user.id)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => ({
    blocked_user_id: r.blocked_user_id,
    blocked_at:      r.created_at,
    expires_at:      r.expires_at ?? null,
    reason:          r.reason     ?? null,
    username:        r.profile?.username   ?? null,
    avatar_url:      r.profile?.avatar_url ?? null,
  }));
}

export async function unblockCoHost(userId: string): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();
  // Parität zu mobile: RPC `unblock_cohost(p_user_id)` — SECURITY DEFINER,
  // prüft host_id = auth.uid() intern.
  const { error } = await supabase.rpc('unblock_cohost', { p_user_id: userId });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/cohost-blocks');
  return { ok: true, data: null };
}
