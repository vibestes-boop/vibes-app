import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type SellerProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
};

export type SoldItem = {
  id: string;
  title: string;
  image_url: string | null;
  current_bid_cents: number | null;
  settled_at: string | null;
};

export function useSellerProfile(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'seller-profile', id],
    enabled: enabled && Boolean(id),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<SellerProfile | null> => {
      // ⚠️ `banner_url` ist erst seit Migration 20260816170000 für Clients
      // lesbar. `profiles` trägt seit dem 14.08. eine ausdrückliche
      // Spaltenliste statt eines Tabellen-SELECT — eine Spalte, die dort fehlt,
      // lässt die GANZE Abfrage mit 42501 scheitern, nicht nur sich selbst.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, banner_url, bio')
        .eq('id', id!)
        .abortSignal(signal).maybeSingle().retry(false);
      if (error) throw error;
      return (data as SellerProfile) ?? null;
    },
  });
}

/** Läuft dieser Verkäufer gerade? Dann ist der Weg zurück ins Live einen Knopf wert. */
export function useSellerLiveShow(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'seller-live', id],
    enabled: enabled && Boolean(id),
    refetchInterval: 30_000,
    queryFn: async ({ signal }): Promise<{ id: string; title: string | null; women_only: boolean } | null> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, title, women_only')
        .eq('host_id', id!)
        .eq('status', 'active')
        .eq('app', 'berkat')
        .order('started_at', { ascending: false })
        .limit(1)
        .abortSignal(signal).maybeSingle().retry(false);
      if (error) throw error;
      return (data as { id: string; title: string | null; women_only: boolean }) ?? null;
    },
  });
}

/** Was dieser Verkäufer zuletzt verkauft hat — die ehrlichste Auslage. */
export function useSellerSoldItems(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'seller-items', id],
    enabled: enabled && Boolean(id),
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<SoldItem[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, current_bid_cents, settled_at')
        .eq('seller_id', id!)
        .eq('status', 'sold')
        .order('settled_at', { ascending: false })
        .limit(30).abortSignal(signal).retry(false);
      if (error) throw error;
      return (data ?? []) as SoldItem[];
    },
  });
}
