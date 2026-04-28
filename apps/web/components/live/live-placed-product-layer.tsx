'use client';

// -----------------------------------------------------------------------------
// LivePlacedProductLayer — v1.w.UI.208
//
// Renders host-placed product cards as positioned overlays on the live stream.
// Mobile parity: components/live/LivePlacedProductLayer.tsx (v1.22.0).
//
// Distinct from the "pinned product pill" (single shop-mode featured product):
// the host can place multiple product cards at arbitrary positions, identical
// to the sticker-placement pattern (same DB coordinate system, same drag UX).
//
// Host mode (isHost=true):
//   • Cards are pointer-draggable (local, DB write on release)
//   • Right-click → context menu → soft-delete (removed_at)
// Viewer mode (default):
//   • Click → navigate to /shop/[productId]
//   • pointer-events-auto so cards are tappable
//
// Positions stored in mobile reference space (390 × 844 pt); converted to
// CSS percentages for responsive display.
// -----------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const REF_W = 390;
const REF_H = 844;

interface PlacedProductRow {
  id: string;
  product_id: string;
  position_x: number;
  position_y: number;
  title: string;
  price_coins: number;
  sale_price_coins: number | null;
  cover_url: string | null;
}

export interface LivePlacedProductLayerProps {
  sessionId: string;
  /** When true, cards are draggable + right-click removable (host deck). */
  isHost?: boolean;
}

export function LivePlacedProductLayer({
  sessionId,
  isHost = false,
}: LivePlacedProductLayerProps) {
  const [products, setProducts] = useState<PlacedProductRow[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    id: string;
    startPtrX: number;
    startPtrY: number;
    origPctX: number;
    origPctY: number;
  } | null>(null);

  const localPosRef = useRef<Record<string, { pctX: number; pctY: number }>>({});
  const [localPos, setLocalPos] = useState<Record<string, { pctX: number; pctY: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // ── Fetch + realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from('live_placed_products')
        .select(
          `id, product_id, position_x, position_y,
           products ( title, price_coins, sale_price_coins, cover_url )`,
        )
        .eq('session_id', sessionId)
        .is('removed_at', null)
        .order('created_at', { ascending: true });

      const rows = ((data ?? []) as unknown as {
        id: string;
        product_id: string;
        position_x: number;
        position_y: number;
        products: {
          title: string;
          price_coins: number;
          sale_price_coins: number | null;
          cover_url: string | null;
        } | null;
      }[])
        .filter((r) => r.products !== null)
        .map((r) => ({
          id: r.id,
          product_id: r.product_id,
          position_x: r.position_x,
          position_y: r.position_y,
          title: r.products!.title,
          price_coins: r.products!.price_coins,
          sale_price_coins: r.products!.sale_price_coins,
          cover_url: r.products!.cover_url,
        }));

      setProducts(rows);
    }

    void fetch();

    const channel = supabase
      .channel(`live-placed-products-web-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_placed_products',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void fetch(),
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [sessionId]);

  // ── Host drag handlers ──────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, p: PlacedProductRow) => {
      if (!isHost) return;
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        id: p.id,
        startPtrX: e.clientX,
        startPtrY: e.clientY,
        origPctX: (p.position_x / REF_W) * 100,
        origPctY: (p.position_y / REF_H) * 100,
      };
      setDraggingId(p.id);
    },
    [isHost],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dxPct = ((e.clientX - dragRef.current.startPtrX) / rect.width) * 100;
    const dyPct = ((e.clientY - dragRef.current.startPtrY) / rect.height) * 100;
    const pctX = Math.max(2, Math.min(88, dragRef.current.origPctX + dxPct));
    const pctY = Math.max(2, Math.min(92, dragRef.current.origPctY + dyPct));
    localPosRef.current[dragRef.current.id] = { pctX, pctY };
    setLocalPos((prev) => ({ ...prev, [dragRef.current!.id]: { pctX, pctY } }));
  }, []);

  const handlePointerUp = useCallback(async () => {
    if (!dragRef.current) return;
    const { id } = dragRef.current;
    const local = localPosRef.current[id];
    dragRef.current = null;
    setDraggingId(null);
    if (!local) return;
    const dbX = (local.pctX / 100) * REF_W;
    const dbY = (local.pctY / 100) * REF_H;
    const supabase = createClient();
    await supabase
      .from('live_placed_products')
      .update({ position_x: dbX, position_y: dbY })
      .eq('id', id);
    setLocalPos((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    delete localPosRef.current[id];
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (!isHost) return;
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ id, x: e.clientX, y: e.clientY });
    },
    [isHost],
  );

  const handleRemove = useCallback(async (id: string) => {
    setCtxMenu(null);
    const supabase = createClient();
    await supabase
      .from('live_placed_products')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (products.length === 0 && !isHost) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={[
          'absolute inset-0 overflow-hidden',
          isHost ? '' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden={!isHost}
        onPointerMove={isHost ? handlePointerMove : undefined}
        onPointerUp={isHost ? () => { void handlePointerUp(); } : undefined}
      >
        {products.map((p) => {
          const local = localPos[p.id];
          const pctX = local ? local.pctX : (p.position_x / REF_W) * 100;
          const pctY = local ? local.pctY : (p.position_y / REF_H) * 100;
          const isDragging = draggingId === p.id;
          const displayPrice = p.sale_price_coins ?? p.price_coins;

          const card = (
            <div
              className={[
                'w-[84px] overflow-hidden rounded-xl shadow-elevation-3',
                'bg-black/70 backdrop-blur-md ring-1 ring-white/15',
                'select-none',
                isHost ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer',
                isDragging ? 'z-10 ring-2 ring-white/50 scale-105' : '',
              ].join(' ')}
              style={{ transition: isDragging ? 'none' : 'transform 150ms ease, box-shadow 150ms ease' }}
              onPointerDown={isHost ? (e) => handlePointerDown(e, p) : undefined}
              onContextMenu={isHost ? (e) => handleContextMenu(e, p.id) : undefined}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square w-full bg-white/5">
                {p.cover_url ? (
                  <Image
                    src={p.cover_url}
                    alt={p.title}
                    fill
                    sizes="84px"
                    className="object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-white/30" />
                  </div>
                )}
              </div>

              {/* Info row */}
              <div className="px-1.5 py-1">
                <p className="truncate text-[10px] leading-tight text-white/90 font-medium">
                  {p.title}
                </p>
                <p className="mt-0.5 text-[10px] leading-none text-amber-400 font-semibold">
                  🪙 {displayPrice.toLocaleString('de-DE')}
                </p>
              </div>
            </div>
          );

          return (
            <div
              key={p.id}
              className="absolute pointer-events-auto"
              style={{
                left: `${pctX}%`,
                top: `${pctY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {isHost ? (
                card
              ) : (
                <Link href={`/shop/${p.product_id}` as Route} aria-label={p.title}>
                  {card}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Context menu — host only */}
      {ctxMenu && isHost && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
          />
          <div
            className="fixed z-50 min-w-[150px] rounded-lg border bg-popover p-1 shadow-lg"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => void handleRemove(ctxMenu.id)}
            >
              Produkt entfernen
            </button>
          </div>
        </>
      )}
    </>
  );
}
