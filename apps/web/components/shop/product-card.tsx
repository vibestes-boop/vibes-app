import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { MapPin, Truck, Camera, Sparkles, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StarDisplay } from './star-display';
import type { ShopProduct } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// ProductCard — Kanonisches 3:4 Grid-Tile für alle Shop-Listen.
// Blur-Fill-Hintergrund + contain-Foreground, Sale/NEW/Counter-Badges,
// Seller-Row, Title, Stars, Location + Free-Shipping-Pill, Price-Pill, Sold.
//
// Kein Click-Handler — gewickelt in Link zu `/shop/[id]` vom Caller.
// -----------------------------------------------------------------------------

const NEW_THRESHOLD_HOURS = 48;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function effectivePrice(p: ShopProduct): number {
  return p.sale_price_coins ?? p.price_coins;
}

function salePercent(p: ShopProduct): number | null {
  if (p.sale_price_coins == null) return null;
  return Math.round(((p.price_coins - p.sale_price_coins) / p.price_coins) * 100);
}

function isNew(p: ShopProduct): boolean {
  const ts = new Date(p.created_at).getTime();
  if (!Number.isFinite(ts)) return false;
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  return ageHours < NEW_THRESHOLD_HOURS;
}

export function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: ShopProduct;
  className?: string;
  priority?: boolean;
}) {
  const eff = effectivePrice(product);
  const discount = salePercent(product);
  const isSale = discount !== null;
  const fresh = !isSale && isNew(product);

  const cover = product.cover_url ?? product.image_urls[0] ?? null;
  const gallerySize = (product.cover_url ? 1 : 0) + product.image_urls.length;
  const lowStock = product.stock > 0 && product.stock <= 3;
  const soldOut = product.stock === 0;

  return (
    <Link
      href={`/shop/${product.id}` as Route}
      className={cn(
        // Base Card: weiche Elevation-1 als ruhender Zustand, Border nur als
        // Light-Mode-Fallback für Shadow-Sichtbarkeit (`dark:border-border/30`
        // macht die Border im Dark-Mode fast weg, weil Shadow dort via Border-
        // Kontrast statt via Alpha funktioniert — siehe tailwind.config Tokens).
        'group relative block overflow-hidden rounded-xl bg-card',
        'border border-border/60 dark:border-border/30',
        'shadow-elevation-1',
        // Hover-Lift (duration-base ~200ms mit out-expo-Easing = TikTok-Snap).
        // `translate-y`-Verschiebung kommt aus transform, nicht aus margin —
        // damit keine Layout-Shift auftritt und die GPU composited statt neu
        // paintet.
        'transition-all duration-base ease-out-expo',
        'hover:-translate-y-0.5 hover:shadow-elevation-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        !product.is_active && 'opacity-60',
        className,
      )}
    >
      {/* Hero-Bild 3:4 mit Blur-Fill */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {cover ? (
          <>
            {/* Layer 1: Blur-Background */}
            <Image
              src={cover}
              alt=""
              fill
              priority={priority}
              className="scale-110 object-cover blur-xl"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              aria-hidden
            />
            {/* Layer 2: Dim-Overlay */}
            <div className="absolute inset-0 bg-black/30" />
            {/* Layer 3: Contain-Foreground */}
            <Image
              src={cover}
              alt={product.title}
              fill
              priority={priority}
              className="object-contain"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10 text-6xl">
            {product.category === 'digital' ? '💾' : product.category === 'service' ? '✨' : '📦'}
          </div>
        )}

        {/* Top-Left-Badge (Sale oder NEW) */}
        {isSale && (
          <span className="absolute left-2 top-2 rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            −{discount}%
          </span>
        )}
        {fresh && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            <Sparkles className="h-3 w-3" />
            NEU
          </span>
        )}

        {/* Top-Right-Badge — Image-Counter oder Ausverkauft */}
        {soldOut ? (
          <span className="absolute right-2 top-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
            Ausverkauft
          </span>
        ) : gallerySize > 1 ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            <Camera className="h-3 w-3" />
            {gallerySize}
          </span>
        ) : null}

        {/* Bottom-Right — Low-Stock-Warning */}
        {lowStock && !soldOut && (
          <span className="absolute bottom-2 right-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
            Nur noch {product.stock}
          </span>
        )}

        {/* Women-Only-Badge */}
        {product.women_only && (
          <span
            className="absolute bottom-2 left-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/90 text-xs text-white"
            title="Nur für Frauen"
          >
            ♀
          </span>
        )}

        {/* Nicht-aktiv Overlay (nur sichtbar für Owner im Studio) */}
        {!product.is_active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-foreground">
              Inaktiv
            </span>
          </div>
        )}
      </div>

      {/* Text-Bereich */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Seller-Row */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">@{product.seller.username}</span>
          {product.seller.verified && <BadgeCheck className="h-3 w-3 flex-none text-sky-500" />}
        </div>

        {/* Titel */}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-foreground">
          {product.title}
        </h3>

        {/* Stars */}
        {product.review_count > 0 && (
          <StarDisplay rating={product.avg_rating} count={product.review_count} />
        )}

        {/* Location + Gratis-Versand */}
        {(product.location || product.free_shipping) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {product.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-none" />
                <span className="truncate">{product.location}</span>
              </span>
            )}
            {product.free_shipping && product.category === 'physical' && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                <Truck className="h-3 w-3" />
                Gratis
              </span>
            )}
          </div>
        )}

        {/* Preis + Sold */}
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                // Preis = primärer Haken auf der Karte, deshalb font-bold (nicht
                // nur -semibold). Inter rendert 700 deutlich präsenter als 600
                // — hilft Scan-Ability in dichten Grid-Listen.
                'text-base font-bold tabular-nums',
                isSale && 'text-red-500',
              )}
            >
              🪙 {eff.toLocaleString('de-DE')}
            </span>
            {isSale && (
              <span className="text-xs text-muted-foreground line-through tabular-nums">
                {product.price_coins.toLocaleString('de-DE')}
              </span>
            )}
          </div>
          {product.sold_count > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatCount(product.sold_count)}× verkauft
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Skeleton — identischer Aspect-Ratio + Text-Platzhalter für Lade-Zustand.
// -----------------------------------------------------------------------------

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-elevation-1 dark:border-border/30">
      <div className="aspect-[3/4] w-full animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function ProductCardGridSkeleton({ count = 8 }: { count?: number }) {
  // Grid-Cap bei lg:4 (v1.w.UI.1 — C1 aus UI_AUDIT). Vorher: `2xl:grid-cols-5`.
  // Warum rausgenommen: auf 2560px-Displays produzierte 5-col-Layout extrem
  // schmale Cards (~200px Breite), die Blur-Fill-Aesthetic zerbröselt dort.
  // TikTok-Shop cappt ebenfalls bei 4 pro Reihe mit großzügiger Breite-pro-Tile.
  // Gap 3 → 4 (zusätzliche visuelle Ruhe zwischen Cards jetzt wo sie gelifted
  // sind und Hover-Shadow brauchen Clearance zum Nachbarn).
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
