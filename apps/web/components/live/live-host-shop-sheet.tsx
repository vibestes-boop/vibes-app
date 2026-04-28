'use client';

// -----------------------------------------------------------------------------
// LiveHostShopSheet — v1.w.UI.200
//
// Viewer-seitiger Produkt-Katalog des Hosts, geöffnet via ShoppingBag-Button
// im Live-Viewer-Overlay. Parity mit `components/live/HostShopSheet.tsx` (mobile).
//
// Zeigt alle aktiven Produkte des Hosts als 2-Spalten-Grid.
// Tap → /shop/[id] (Detail-Seite).
//
// Aufgerufen von /live/[id]/page.tsx über <LiveHostShopBadge> wenn
// session.shop_enabled === true.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { X, ShoppingBag, Package, Coins } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { glassPillStrong } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

interface ShopItem {
  id: string;
  title: string;
  price_coins: number;
  sale_price_coins: number | null;
  cover_url: string | null;
  category: 'digital' | 'physical' | 'service';
  stock: number;
}

interface LiveHostShopSheetProps {
  hostId: string;
  hostUsername: string;
  onClose: () => void;
}

export function LiveHostShopSheet({ hostId, hostUsername, onClose }: LiveHostShopSheetProps) {
  const [products, setProducts] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.rpc('get_shop_products', {
          p_seller_id: hostId,
          p_limit: 40,
          p_offset: 0,
        });
        setProducts((data ?? []) as ShopItem[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [hostId]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-black/90 shadow-elevation-4 backdrop-blur-xl ring-1 ring-white/15"
        style={{ maxHeight: '80dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          <ShoppingBag className="h-4 w-4 text-white/70" />
          <p className="flex-1 text-sm font-semibold text-white">
            @{hostUsername}&apos;s Shop
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-white/10" />

        {/* Product grid */}
        <div className="overflow-y-auto p-3" style={{ maxHeight: 'calc(80dvh - 80px)' }}>
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-white/10" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-white/50">
              <Package className="h-10 w-10" />
              <p className="text-sm">Keine Produkte verfügbar</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => {
                const price = p.sale_price_coins ?? p.price_coins;
                const outOfStock = p.stock === 0;
                return (
                  <Link
                    key={p.id}
                    href={`/shop/${p.id}` as Route}
                    onClick={onClose}
                    className={cn(
                      'group relative flex flex-col overflow-hidden rounded-xl ring-1 ring-white/10 transition-transform hover:scale-[1.02]',
                      outOfStock && 'opacity-60',
                    )}
                  >
                    {/* Cover image */}
                    <div className="relative aspect-square bg-white/5">
                      {p.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.cover_url}
                          alt={p.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-8 w-8 text-white/25" />
                        </div>
                      )}

                      {/* Sale badge */}
                      {p.sale_price_coins && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          -{Math.round((1 - p.sale_price_coins / p.price_coins) * 100)}%
                        </span>
                      )}

                      {/* Out-of-stock */}
                      {outOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                            Ausverkauft
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="bg-black/60 px-2 py-1.5">
                      <p className="line-clamp-2 text-[11px] font-medium leading-tight text-white">
                        {p.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Coins className="h-3 w-3 text-amber-400" />
                        <span className="text-[11px] font-semibold text-amber-400">
                          {price.toLocaleString()}
                        </span>
                        {p.sale_price_coins && (
                          <span className="text-[10px] text-white/40 line-through">
                            {p.price_coins.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LiveHostShopBadge — ShoppingBag-Button + gated Sheet.
// Rendered als Client-Wrapper so der RSC die open-State nicht halten muss.
// -----------------------------------------------------------------------------

export function LiveHostShopBadge({
  hostId,
  hostUsername,
  productCount,
}: {
  hostId: string;
  hostUsername: string;
  productCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          glassPillStrong,
          'relative inline-flex h-10 w-10 items-center justify-center rounded-full shadow-elevation-1',
        )}
        aria-label="Host-Shop öffnen"
        title="Host-Shop"
      >
        <ShoppingBag className="h-5 w-5 text-white" strokeWidth={1.8} />
        {productCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-1 ring-black/40">
            {productCount > 99 ? '99+' : productCount}
          </span>
        )}
      </button>

      {open && (
        <LiveHostShopSheet
          hostId={hostId}
          hostUsername={hostUsername}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
