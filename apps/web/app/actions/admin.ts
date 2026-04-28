'use server';

// -----------------------------------------------------------------------------
// Admin Server Actions — v1.w.UI.215
//
// Alle Mutations für das Admin-Panel. Reads laufen direkt im Server-Component
// (getAdminStats, searchAdminUsers) oder via revalidatePath + refresh.
//
// Sicherheit: Alle Supabase-Calls sind SECURITY DEFINER RPCs oder direkte
// Tabellenzugriffe — RLS-Policies blocken Nicht-Admin-User auf DB-Ebene.
// Zusätzlich prüfen wir is_admin im aufrufenden Server-Component (Layout).
// -----------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users:     number;
  new_users_7d:    number;
  total_posts:     number;
  active_lives:    number;
  total_orders:    number;
  total_revenue:   number;
  pending_reports: number;
}

export interface AdminUser {
  id:                  string;
  username:            string;
  display_name:        string | null;
  avatar_url:          string | null;
  is_verified:         boolean;
  is_admin:            boolean;
  is_banned:           boolean;
  women_only_verified: boolean;
  is_creator:          boolean;
  created_at:          string;
  post_count:          number;
  follower_count:      number;
}

export interface ContentReport {
  id:          string;
  reporter_id: string;
  target_type: 'post' | 'user' | 'live' | string;
  target_id:   string;
  reason:      string;
  status:      'pending' | 'reviewed' | 'dismissed';
  admin_note:  string | null;
  created_at:  string;
  reviewed_at: string | null;
  reporter:    { username: string } | null;
}

export interface SellerBalance {
  seller_id:       string;
  username:        string;
  avatar_url:      string | null;
  diamond_balance: number;
  total_earned:    number;
  pending_orders:  number;
}

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ─── Auth guard helper ────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: 'Bitte zuerst anmelden.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return { supabase, user: null, error: 'Keine Admin-Berechtigung.' };
  }
  return { supabase, user, error: null };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error || !data) {
    return {
      total_users: 0, new_users_7d: 0, total_posts: 0,
      active_lives: 0, total_orders: 0, total_revenue: 0, pending_reports: 0,
    };
  }
  return data as AdminStats;
}

// ─── User search ──────────────────────────────────────────────────────────────

export async function searchAdminUsers(query: string): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query:  query || '',
    p_limit:  40,
    p_offset: 0,
  });
  if (error) return [];
  return (data ?? []) as AdminUser[];
}

// ─── User mutations ───────────────────────────────────────────────────────────

export async function adminBanUser(userId: string, ban: boolean): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: ban })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function adminVerifyUser(userId: string, verify: boolean): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: verify })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function adminToggleAdmin(userId: string, isAdmin: boolean): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/users');
  return { ok: true };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getAdminReports(
  status?: 'pending' | 'reviewed' | 'dismissed',
): Promise<ContentReport[]> {
  const supabase = await createClient();
  let q = supabase
    .from('content_reports')
    .select('*, reporter:profiles!reporter_id(username)')
    .order('created_at', { ascending: false })
    .limit(60);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as unknown as ContentReport[];
}

export async function adminResolveReport(
  reportId: string,
  status: 'reviewed' | 'dismissed',
  adminNote?: string,
): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireAdmin();
  if (authErr || !user) return { ok: false, error: authErr ?? 'Auth-Fehler' };

  const { error } = await supabase
    .from('content_reports')
    .update({
      status,
      admin_note:  adminNote ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', reportId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/reports');
  return { ok: true };
}

// ─── Seller balances ──────────────────────────────────────────────────────────

export async function getSellerBalances(): Promise<SellerBalance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_get_seller_balances');
  if (error) return [];
  return (data ?? []) as SellerBalance[];
}
