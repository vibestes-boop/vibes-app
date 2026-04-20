/**
 * lib/useLiveShopping.ts — Live-Shopping über bestehenden Realtime-Channel
 *
 * Erweitert den `live:{sessionId}` Channel mit neuen Event-Typen:
 *  - product_pin:    Host pinnt Produkt → alle Viewer sehen Produkt-Pill
 *  - product_unpin:  Host entpinnt → Pill verschwindet
 *  - product_sold:   Jemand gekauft → "🛍 @username hat X gekauft!" Banner
 *
 * Kein neuer Channel nötig — gleiche Infrastruktur wie Gifts.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface PinnedProduct {
  productId: string;
  title:     string;
  price:     number;
  coverUrl:  string | null;
  category:  'digital' | 'physical' | 'service';
}

export interface ProductSoldEvent {
  productId:       string;
  productTitle:    string;
  buyerUsername:   string;
  quantity:        number;
}

type LiveShoppingPayload =
  | { type: 'product_pin';   product: PinnedProduct }
  | { type: 'product_unpin'; productId: string }
  | { type: 'product_sold';  event: ProductSoldEvent };

// ─── Hook: useLiveShopping (Viewer-Seite) ─────────────────────────────────────
//
// Hört auf dem gleichen Channel wie Gifts auf product_* Events.
// channelRef kommt aus useGiftStream — wir subscriben auf denselben Channel.

export function useLiveShopping(liveSessionId: string) {
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);
  const [soldEvents, setSoldEvents]       = useState<ProductSoldEvent[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!liveSessionId) return;

    const channel = supabase.channel(`live-shop:${liveSessionId}`, {
      config: { broadcast: { ack: false, self: true } },
    });

    channel.on('broadcast', { event: 'shop' }, ({ payload }: { payload: LiveShoppingPayload }) => {
      switch (payload.type) {
        case 'product_pin':
          setPinnedProduct(payload.product);
          break;

        case 'product_unpin':
          setPinnedProduct(prev =>
            prev?.productId === payload.productId ? null : prev
          );
          break;

        case 'product_sold':
          setSoldEvents(prev => {
            const next = [payload.event, ...prev].slice(0, 5); // max 5 in Queue
            return next;
          });
          // Sold-Banner nach 4s automatisch entfernen
          setTimeout(() => {
            setSoldEvents(prev => prev.filter(e => e.productId !== payload.event.productId));
          }, 4000);
          break;
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [liveSessionId]);

  /** Viewer kauft gepinntes Produkt — broadcast an alle */
  const broadcastSold = useCallback(async (event: ProductSoldEvent) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type:    'broadcast',
      event:   'shop',
      payload: { type: 'product_sold', event } satisfies LiveShoppingPayload,
    });
  }, []);

  return { pinnedProduct, soldEvents, broadcastSold };
}

// ─── Hook: useLiveShoppingHost (Host-Seite) ────────────────────────────────────
//
// Host pinnt/entpinnt Produkte. Eigener Channel (self: true damit Host es direkt sieht).

export function useLiveShoppingHost(liveSessionId: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);

  useEffect(() => {
    if (!liveSessionId) return;

    const channel = supabase.channel(`live-shop:${liveSessionId}`, {
      config: { broadcast: { ack: false, self: true } },
    });

    // Host hört auch auf seinen eigenen Broadcasts (self: true)
    channel.on('broadcast', { event: 'shop' }, ({ payload }: { payload: LiveShoppingPayload }) => {
      if (payload.type === 'product_pin')   setPinnedProduct(payload.product);
      if (payload.type === 'product_unpin') setPinnedProduct(null);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channelRef.current = channel;
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [liveSessionId]);

  /** Host pinnt ein Produkt */
  const pinProduct = useCallback(async (product: PinnedProduct) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type:    'broadcast',
      event:   'shop',
      payload: { type: 'product_pin', product } satisfies LiveShoppingPayload,
    });
    setPinnedProduct(product);
  }, []);

  /** Host entpinnt */
  const unpinProduct = useCallback(async (productId: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type:    'broadcast',
      event:   'shop',
      payload: { type: 'product_unpin', productId } satisfies LiveShoppingPayload,
    });
    setPinnedProduct(null);
  }, []);

  return { pinnedProduct, pinProduct, unpinProduct };
}
