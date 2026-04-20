/**
 * lib/useLivePlacedProducts.ts
 *
 * v1.22.0 — Live-Placed-Products (frei platzierbare Produkt-Karten)
 *
 * Host platziert Shop-Produkte als Karten auf seinem Stream.
 * Viewer sehen sie an der Host-Position und können sie antippen,
 * um zur Produkt-Detailseite zu gelangen.
 *
 * Hooks:
 *   useActivePlacedProducts(sessionId) → { products, isLoading }
 *   usePlacedProductActions(sessionId) → { placeProduct, moveProduct, unpinProduct }
 *
 * Positions-Pattern identisch zu Stickers:
 *   • Drag live via useLiveOverlayPosition (Broadcast, on-release)
 *   • Final-Commit in DB via moveProduct (spät joinende Viewer + Restart)
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';
import type { ProductCategory } from './useShop';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlacedProduct {
  id:          string;
  sessionId:   string;
  hostId:      string;
  productId:   string;
  positionX:   number;
  positionY:   number;
  createdAt:   string;
  // Joined from products
  title:       string;
  priceCoins:  number;
  coverUrl:    string | null;
  category:    ProductCategory;
}

interface RawRow {
  id:          string;
  session_id:  string;
  host_id:     string;
  product_id:  string;
  position_x:  number;
  position_y:  number;
  created_at:  string;
  removed_at:  string | null;
  products:    {
    title:       string;
    price_coins: number;
    cover_url:   string | null;
    category:    ProductCategory;
  } | null;
}

function mapRow(r: RawRow): PlacedProduct | null {
  if (!r.products) return null;
  return {
    id:         r.id,
    sessionId:  r.session_id,
    hostId:     r.host_id,
    productId:  r.product_id,
    positionX:  r.position_x,
    positionY:  r.position_y,
    createdAt:  r.created_at,
    title:      r.products.title,
    priceCoins: r.products.price_coins,
    coverUrl:   r.products.cover_url,
    category:   r.products.category,
  };
}

// ─── Active query + realtime ────────────────────────────────────────────────

export function useActivePlacedProducts(sessionId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery<PlacedProduct[]>({
    queryKey:  ['live-placed-products', sessionId],
    enabled:   !!sessionId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('live_placed_products')
        .select(`
          id, session_id, host_id, product_id,
          position_x, position_y, created_at, removed_at,
          products:product_id ( title, price_coins, cover_url, category )
        `)
        .eq('session_id', sessionId)
        .is('removed_at', null)
        .order('created_at', { ascending: true });
      if (error) {
        __DEV__ && console.warn('[useActivePlacedProducts]', error.message);
        return [];
      }
      return (data ?? [])
        .map((r) => mapRow(r as unknown as RawRow))
        .filter((x): x is PlacedProduct => x !== null);
    },
  });

  // Realtime
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`live-placed-products-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_placed_products',
          filter: `session_id=eq.${sessionId}`,
        },
        () => { qc.invalidateQueries({ queryKey: ['live-placed-products', sessionId] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, qc]);

  return {
    products:  query.data ?? [],
    isLoading: query.isLoading,
  };
}

// ─── Host-seitige Mutationen ────────────────────────────────────────────────

export function usePlacedProductActions(sessionId: string | null | undefined) {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['live-placed-products', sessionId] });
  }, [qc, sessionId]);

  // ── placeProduct ───────────────────────────────────────────────────────
  const placeMut = useMutation({
    mutationFn: async ({
      productId, positionX, positionY,
    }: { productId: string; positionX?: number; positionY?: number }) => {
      if (!userId || !sessionId) throw new Error('Nicht eingeloggt oder keine Session');
      const { error } = await supabase
        .from('live_placed_products')
        .insert({
          session_id: sessionId,
          host_id:    userId,
          product_id: productId,
          position_x: positionX ?? 40,
          position_y: positionY ?? 260,
        });
      if (error) {
        // Duplicate (gleicher Produkt schon platziert) — ignorieren, ist ok
        if (!error.message.includes('duplicate')) throw error;
      }
    },
    onSuccess: invalidate,
  });

  // ── moveProduct ────────────────────────────────────────────────────────
  const moveMut = useMutation({
    mutationFn: async ({
      id, positionX, positionY,
    }: { id: string; positionX: number; positionY: number }) => {
      const { error } = await supabase
        .from('live_placed_products')
        .update({ position_x: positionX, position_y: positionY })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, positionX, positionY }) => {
      await qc.cancelQueries({ queryKey: ['live-placed-products', sessionId] });
      const prev = qc.getQueryData<PlacedProduct[]>(['live-placed-products', sessionId]);
      if (prev) {
        qc.setQueryData<PlacedProduct[]>(
          ['live-placed-products', sessionId],
          prev.map((p) => (p.id === id ? { ...p, positionX, positionY } : p)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['live-placed-products', sessionId], ctx.prev);
    },
  });

  // ── unpinProduct ───────────────────────────────────────────────────────
  const unpinMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('live_placed_products')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['live-placed-products', sessionId] });
      const prev = qc.getQueryData<PlacedProduct[]>(['live-placed-products', sessionId]);
      if (prev) {
        qc.setQueryData<PlacedProduct[]>(
          ['live-placed-products', sessionId],
          prev.filter((p) => p.id !== id),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['live-placed-products', sessionId], ctx.prev);
    },
    onSettled: invalidate,
  });

  return useMemo(() => ({
    placeProduct:  placeMut.mutateAsync,
    moveProduct:   moveMut.mutateAsync,
    unpinProduct:  unpinMut.mutateAsync,
    isPlacing:     placeMut.isPending,
    isMoving:      moveMut.isPending,
    isUnpinning:   unpinMut.isPending,
  }), [placeMut, moveMut, unpinMut]);
}
