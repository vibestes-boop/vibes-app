/**
 * lib/useLiveShopMode.ts
 *
 * v1.22.x — TikTok-Style Live-Shop-Mode
 *
 * Liest live_sessions.shop_enabled und subscribed auf Realtime-Updates,
 * damit Viewer sofort die Shop-Tüte sehen, wenn der Host den Modus
 * einschaltet. Der Host kann via toggleShopMode() ein/ausschalten
 * (via set_live_shop_mode RPC, enforced auf Host-Identität).
 *
 * Orthogonal zu bestehenden Systemen:
 *   • Kein Impact auf useLiveShopping (broadcast-basiertes Featured Pill)
 *   • Kein Impact auf useLivePlacedProducts (frei platzierte Karten)
 *
 * Nutzung:
 *   const { shopEnabled, isLoading } = useLiveShopMode(sessionId);
 *   const { toggleShopMode, isToggling } = useLiveShopModeActions(sessionId);
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Product } from './useShop';

// ─── Read hook (Viewer + Host) ─────────────────────────────────────────────

export function useLiveShopMode(sessionId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery<boolean>({
    queryKey:  ['live-shop-mode', sessionId],
    enabled:   !!sessionId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!sessionId) return false;
      const { data, error } = await supabase
        .from('live_sessions')
        .select('shop_enabled')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) {
        __DEV__ && console.warn('[useLiveShopMode] read failed:', error.message);
        return false;
      }
      return Boolean(data?.shop_enabled);
    },
  });

  // Realtime subscription auf live_sessions Row
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`live-shop-mode-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const next = (payload.new as { shop_enabled?: boolean } | null)?.shop_enabled;
          if (typeof next === 'boolean') {
            qc.setQueryData(['live-shop-mode', sessionId], next);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, qc]);

  return {
    shopEnabled: query.data ?? false,
    isLoading:   query.isLoading,
  };
}

// ─── Host-seitige Actions ──────────────────────────────────────────────────

export function useLiveShopModeActions(sessionId: string | null | undefined) {
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!sessionId) throw new Error('no_session');
      const { data, error } = await supabase.rpc('set_live_shop_mode', {
        p_session_id: sessionId,
        p_enabled:    enabled,
      });
      if (error) throw error;
      return Boolean(data);
    },
    // Optimistic: sofort local umschalten, Realtime korrigiert ggf.
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: ['live-shop-mode', sessionId] });
      const prev = qc.getQueryData<boolean>(['live-shop-mode', sessionId]);
      qc.setQueryData(['live-shop-mode', sessionId], enabled);
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['live-shop-mode', sessionId], ctx.prev);
      }
      // v1.22.1: sichtbares Feedback, damit stille Fehler (z.B. fehlende
      // Migration in Prod, "function set_live_shop_mode does not exist")
      // sofort im UI auftauchen statt ins Leere zu kippen.
      const msg = e?.message ?? 'Unbekannter Fehler';
      __DEV__ && console.warn('[useLiveShopMode] toggle failed:', msg);
      Alert.alert('Shop-Modus nicht umgeschaltet', msg);
    },
  });

  const toggleShopMode = useCallback(
    (enabled: boolean) => mut.mutateAsync(enabled),
    [mut],
  );

  return useMemo(() => ({
    toggleShopMode,
    isToggling: mut.isPending,
  }), [toggleShopMode, mut.isPending]);
}

// ─── Host-Shop-Katalog (für Viewer-Sheet + Badge-Count) ────────────────────

/**
 * Lädt den gesamten aktiven Katalog eines Hosts (für den Viewer-Browse-Sheet
 * und den Bag-Button-Count-Badge). Nutzt den bestehenden get_shop_products
 * RPC, gefiltert nach Seller und mit hohem Limit (Katalog während Live
 * üblicherweise < 100 Produkte).
 *
 * Bewusst kurze staleTime, da Stock / Rabatte sich während eines Streams
 * ändern können (z.B. Host legt neues Produkt an).
 */
export function useHostShopProducts(hostId: string | null | undefined) {
  const query = useQuery<Product[]>({
    queryKey:  ['host-shop-products', hostId],
    enabled:   !!hostId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!hostId) return [];
      const { data, error } = await supabase.rpc('get_shop_products', {
        p_seller_id: hostId,
        p_category:  null,
        p_limit:     100,
        p_offset:    0,
      });
      if (error) {
        __DEV__ && console.warn('[useHostShopProducts]', error.message);
        return [];
      }
      return (data ?? []) as Product[];
    },
  });

  return {
    products:  query.data ?? [],
    count:     query.data?.length ?? 0,
    isLoading: query.isLoading,
  };
}
