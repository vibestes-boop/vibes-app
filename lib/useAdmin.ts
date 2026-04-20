/**
 * lib/useAdmin.ts — Admin-Hooks
 *
 * Alle Hooks für das Admin-Panel.
 * Rufen nur RPCs auf die SECURITY DEFINER haben und is_admin intern prüfen.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// ─── Platform-Statistiken ─────────────────────────────────────────────────────

export interface AdminStats {
  total_users:   number;
  new_users_7d:  number;
  total_posts:   number;
  active_lives:  number;
  total_orders:  number;
  total_revenue: number; // Coins
  pending_reports: number;
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) throw error;
      return data as AdminStats;
    },
  });
}

// ─── Nutzersuche ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id:             string;
  username:       string;
  avatar_url:     string | null;
  is_verified:    boolean;
  is_admin:       boolean;
  is_banned:      boolean;
  women_only_verified: boolean;
  created_at:     string;
  post_count:     number;
  follower_count: number;
}

export function useAdminUsers(query: string) {
  return useQuery<AdminUser[]>({
    queryKey: ['admin-users', query],
    staleTime: 30 * 1000,
    enabled: query.length >= 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_search_users', {
        p_query: query || '',
        p_limit: 40,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

// ─── User-Aktionen ────────────────────────────────────────────────────────────

export function useAdminBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: ban })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useAdminVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, verify }: { userId: string; verify: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: verify })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useAdminToggleAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: isAdmin })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ContentReport {
  id:          string;
  reporter_id: string;
  target_type: 'post' | 'user' | 'live';
  target_id:   string;
  reason:      string;
  status:      'pending' | 'reviewed' | 'dismissed';
  admin_note:  string | null;
  created_at:  string;
  reporter?: { username: string };
}

export function useAdminReports(status?: 'pending' | 'reviewed' | 'dismissed') {
  return useQuery<ContentReport[]>({
    queryKey: ['admin-reports', status],
    staleTime: 30 * 1000,
    queryFn: async () => {
      let q = supabase
        .from('content_reports')
        .select('*, reporter:profiles!reporter_id(username)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContentReport[];
    },
  });
}

export function useAdminResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      status,
      adminNote,
    }: { reportId: string; status: 'reviewed' | 'dismissed'; adminNote?: string }) => {
      // Aktuellen Admin aus Auth holen (stellt sicher dass reviewed_by korrekt ist)
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('content_reports')
        .update({
          status,
          admin_note:  adminNote ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
}

// ─── Shop-Bestellungen (Admin) ────────────────────────────────────────────────

export interface AdminOrder {
  id:          string;
  buyer_id:    string;
  seller_id:   string;
  total_coins: number;
  status:      string;
  created_at:  string;
  quantity:    number;
  product?:    { title: string };
  buyer?:      { username: string };
  seller?:     { username: string };
}

export function useAdminOrders() {
  return useQuery<AdminOrder[]>({
    queryKey: ['admin-orders'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(title),
          buyer:profiles!buyer_id(username),
          seller:profiles!seller_id(username)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AdminOrder[];
    },
  });
}

export function useAdminUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      deliveryNotes,
    }: { orderId: string; status: string; deliveryNotes?: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status, delivery_notes: deliveryNotes ?? null })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
  });
}

// ─── Diamond-Auszahlungen (Seller-Guthaben) ───────────────────────────────────

export interface SellerBalance {
  seller_id:       string;
  username:        string;
  diamond_balance: number;  // aus wallets.diamonds
  total_earned:    number;  // Summe aller completed orders
  pending_orders:  number;
}

export function useAdminSellerBalances() {
  return useQuery<SellerBalance[]>({
    queryKey: ['admin-seller-balances'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Alle Seller mit completed orders + Diamond-Balance
      const { data, error } = await supabase.rpc('admin_get_seller_balances');
      if (error) {
        // RPC existiert evtl. noch nicht → Fallback: leer zurückgeben
        __DEV__ && console.warn('[Admin] admin_get_seller_balances nicht verfügbar:', error.message);
        return [];
      }
      return (data ?? []) as SellerBalance[];
    },
  });
}
