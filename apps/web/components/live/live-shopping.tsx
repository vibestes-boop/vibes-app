'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, X, FileText, Box, Wrench, Coins, Pin, PinOff } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { glassPillStrong } from '@/lib/ui/glass-pill';
import { buyProduct } from '@/app/actions/shop';

// -----------------------------------------------------------------------------
// Live-Shopping — v1.w.UI.180
//
// Drei Exporte:
//
//  useLiveShopping(sessionId)       — Viewer-Hook. Hört auf product_pin /
//    product_unpin / product_sold Events auf `live-shop:{sessionId}` Channel.
//    Gibt pinnedProduct + soldEvents zurück.
//
//  useLiveShoppingHost(sessionId)   — Host-Hook. Kann pinProduct / unpinProduct
//    broadcasten (self:true → Host sieht eigene Broadcasts sofort).
//
//  LivePinnedProductPill            — Viewer-Overlay unten links. Zeigt
//    gepinntes Produkt mit Cover, Titel, Preis, Kategorie-Icon + Kaufen-Button.
//    Käufe gehen über buyProduct() Server-Action.
//
//  ProductSoldBanner                — Kurzes "🛍 @username hat X gekauft!" Toast
//    (auto-dismiss after 4s).
//
//  LiveShopHostPanel                — Host-seitige Produktliste + Pin/Unpin.
//    Ruft Host's Produkte per Supabase-Query (kein SSR nötig).
// -----------------------------------------------------------------------------

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PinnedProduct {
  productId: string;
  title: string;
  price: number;
  coverUrl: string | null;
  category: 'digital' | 'physical' | 'service';
}

export interface ProductSoldEvent {
  productId: string;
  productTitle: string;
  buyerUsername: string;
  quantity: number;
}

type ShopPayload =
  | { type: 'product_pin'; product: PinnedProduct }
  | { type: 'product_unpin'; productId: string }
  | { type: 'product_sold'; event: ProductSoldEvent };

// ─── useLiveShopping (Viewer) ─────────────────────────────────────────────────

export function useLiveShopping(sessionId: string) {
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);
  const [soldEvents, setSoldEvents] = useState<ProductSoldEvent[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createClient();
    const channel = supabase.channel(`live-shop:${sessionId}`, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel.on('broadcast', { event: 'shop' }, ({ payload }: { payload: ShopPayload }) => {
      switch (payload.type) {
        case 'product_pin':
          setPinnedProduct(payload.product);
          break;
        case 'product_unpin':
          setPinnedProduct((prev) =>
            prev?.productId === payload.productId ? null : prev,
          );
          break;
        case 'product_sold':
          setSoldEvents((prev) => [payload.event, ...prev].slice(0, 5));
          setTimeout(() => {
            setSoldEvents((prev) =>
              prev.filter((e) => e.productId !== payload.event.productId),
            );
          }, 4000);
          break;
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channelRef.current = channel;
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  /** Viewer sendet product_sold nach erfolgreichem Kauf */
  const broadcastSold = useCallback(
    async (event: ProductSoldEvent) => {
      if (!channelRef.current) return;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'shop',
        payload: { type: 'product_sold', event } satisfies ShopPayload,
      });
    },
    [],
  );

  return { pinnedProduct, soldEvents, broadcastSold };
}

// ─── useLiveShoppingHost ──────────────────────────────────────────────────────

export function useLiveShoppingHost(sessionId: string) {
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createClient();
    const channel = supabase.channel(`live-shop:${sessionId}`, {
      config: { broadcast: { ack: false, self: true } },
    });

    channel.on('broadcast', { event: 'shop' }, ({ payload }: { payload: ShopPayload }) => {
      if (payload.type === 'product_pin') setPinnedProduct(payload.product);
      if (payload.type === 'product_unpin') setPinnedProduct(null);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channelRef.current = channel;
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const pinProduct = useCallback(async (product: PinnedProduct) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'shop',
      payload: { type: 'product_pin', product } satisfies ShopPayload,
    });
    setPinnedProduct(product);
  }, []);

  const unpinProduct = useCallback(async (productId: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'shop',
      payload: { type: 'product_unpin', productId } satisfies ShopPayload,
    });
    setPinnedProduct(null);
  }, []);

  return { pinnedProduct, pinProduct, unpinProduct };
}

// ─── LivePinnedProductPill ────────────────────────────────────────────────────

function CatIcon({ category }: { category: PinnedProduct['category'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  if (category === 'digital') return <FileText className={cls} />;
  if (category === 'physical') return <Box className={cls} />;
  return <Wrench className={cls} />;
}

export function LivePinnedProductPill({
  product,
  viewerUsername,
  onSold,
}: {
  product: PinnedProduct;
  viewerUsername: string | null;
  /** Called after a successful purchase so viewer can broadcast the sold event */
  onSold?: (event: ProductSoldEvent) => void;
}) {
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(false);

  const handleBuy = useCallback(async () => {
    if (buying || bought) return;
    setBuying(true);
    try {
      const res = await buyProduct(product.productId);
      if (res.ok) {
        setBought(true);
        toast.success('Kauf erfolgreich! 🛍');
        onSold?.({
          productId: product.productId,
          productTitle: product.title,
          buyerUsername: viewerUsername ?? 'Jemand',
          quantity: 1,
        });
        setTimeout(() => setBought(false), 3000);
      } else {
        toast.error(res.error ?? 'Kauf fehlgeschlagen.');
      }
    } finally {
      setBuying(false);
    }
  }, [buying, bought, product, viewerUsername, onSold]);

  return (
    <div
      className={cn(
        glassPillStrong,
        'flex items-center gap-2 rounded-xl px-3 py-2 shadow-elevation-1',
        'max-w-[280px] sm:max-w-xs',
      )}
    >
      {/* Cover thumbnail */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/10">
        {product.coverUrl ? (
          <Image
            src={product.coverUrl}
            alt={product.title}
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-white/60" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link href={`/shop/${product.productId}`} className="block">
          <p className="line-clamp-1 text-xs font-semibold text-white hover:underline">
            {product.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/70">
            <CatIcon category={product.category} />
            <Coins className="h-3 w-3 text-brand-gold" />
            <span className="font-medium text-brand-gold">
              {product.price.toLocaleString('de-DE')}
            </span>
          </p>
        </Link>
      </div>

      {/* Buy button */}
      <button
        type="button"
        onClick={handleBuy}
        disabled={buying || bought}
        className={cn(
          'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
          bought
            ? 'bg-emerald-500 text-white'
            : 'bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-60',
        )}
      >
        {bought ? '✓' : buying ? '…' : 'Kaufen'}
      </button>
    </div>
  );
}

// ─── ProductSoldBanner ────────────────────────────────────────────────────────

export function ProductSoldBanner({ event }: { event: ProductSoldEvent }) {
  return (
    <div
      className={cn(
        glassPillStrong,
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-elevation-1',
        'text-xs font-medium text-white',
      )}
    >
      <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-brand-gold" />
      <span>
        <span className="font-semibold text-brand-gold">@{event.buyerUsername}</span>
        {' hat '}
        <span className="font-semibold">{event.productTitle}</span>
        {' gekauft!'}
      </span>
    </div>
  );
}

// ─── LiveShopHostPanel ────────────────────────────────────────────────────────
//
// Host-side panel: fetches their active products on mount, lets them pin/unpin.

interface HostProduct {
  id: string;
  title: string;
  price_coins: number;
  cover_url: string | null;
  category: string;
}

export function LiveShopHostPanel({
  sessionId,
  pinnedProduct,
  onPin,
  onUnpin,
}: {
  sessionId: string;
  pinnedProduct: PinnedProduct | null;
  onPin: (p: PinnedProduct) => Promise<void>;
  onUnpin: (productId: string) => Promise<void>;
}) {
  const [products, setProducts] = useState<HostProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('products')
      .select('id, title, price_coins, cover_url, category')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setProducts((data ?? []) as HostProduct[]);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        Produkte laden…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          Noch keine aktiven Produkte.{' '}
          <Link href="/studio/shop" className="underline hover:text-foreground">
            Shop öffnen
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {pinnedProduct && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs">
          <span className="font-medium text-emerald-400">
            📌 {pinnedProduct.title} wird angezeigt
          </span>
          <button
            type="button"
            onClick={() => onUnpin(pinnedProduct.productId)}
            className="ml-2 rounded p-0.5 hover:bg-emerald-500/20"
            aria-label="Pin entfernen"
          >
            <X className="h-3.5 w-3.5 text-emerald-400" />
          </button>
        </div>
      )}

      {products.map((p) => {
        const isPinned = pinnedProduct?.productId === p.id;
        return (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50',
              isPinned && 'bg-emerald-500/10 ring-1 ring-emerald-500/30',
            )}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
              {p.cover_url ? (
                <Image
                  src={p.cover_url}
                  alt={p.title}
                  fill
                  sizes="36px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-medium">{p.title}</p>
              <p className="text-[11px] text-muted-foreground">
                🪙 {p.price_coins.toLocaleString('de-DE')}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                isPinned
                  ? onUnpin(p.id)
                  : onPin({
                      productId: p.id,
                      title: p.title,
                      price: p.price_coins,
                      coverUrl: p.cover_url,
                      category: (p.category as PinnedProduct['category']) ?? 'digital',
                    })
              }
              className={cn(
                'shrink-0 rounded p-1 transition-colors',
                isPinned
                  ? 'text-emerald-500 hover:bg-emerald-500/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-label={isPinned ? 'Entpinnen' : 'Anpinnen'}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
