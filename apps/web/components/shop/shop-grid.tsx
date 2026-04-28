'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ProductCard } from '@/components/shop/product-card';
import type { ShopProduct, ShopCatalogParams } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// ShopGrid — client-side infinite-scroll shell for the shop catalog.
//
// SSR loads the first PAGE_SIZE products; this component takes over and
// appends more via GET /api/shop/products?offset=N&...filters as the user
// scrolls toward the bottom sentinel.
//
// Pattern is identical to HashtagGrid (v1.w.UI.101):
//  - IntersectionObserver on a bottom sentinel
//  - fetchedOffsetRef to prevent StrictMode double-fetches
//  - id-based dedup on merge
// -----------------------------------------------------------------------------

const PAGE_SIZE = 24;

interface ShopGridProps {
  initialProducts: ShopProduct[];
  params: ShopCatalogParams;
}

function buildApiUrl(params: ShopCatalogParams, offset: number): string {
  const sp = new URLSearchParams();
  if (params.category && params.category !== 'all') sp.set('category', params.category);
  if (params.sort) sp.set('sort', params.sort);
  if (params.onSaleOnly) sp.set('sale', '1');
  if (params.freeShippingOnly) sp.set('shipping', '1');
  if (params.minPrice != null) sp.set('min', String(params.minPrice));
  if (params.maxPrice != null) sp.set('max', String(params.maxPrice));
  if (params.q) sp.set('q', params.q);
  sp.set('offset', String(offset));
  sp.set('limit', String(PAGE_SIZE));
  return `/api/shop/products?${sp.toString()}`;
}

export function ShopGrid({ initialProducts, params }: ShopGridProps) {
  const [products, setProducts] = useState<ShopProduct[]>(initialProducts);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(initialProducts.length >= PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchedOffsetRef = useRef<number>(initialProducts.length);

  // When the parent page re-renders with new filter params (force-dynamic),
  // Next.js will unmount+remount this component with fresh initialProducts —
  // these effects are a belt-and-suspenders fallback for client-side transitions.
  useEffect(() => {
    setProducts(initialProducts);
    setHasMore(initialProducts.length >= PAGE_SIZE);
    fetchedOffsetRef.current = initialProducts.length;
  }, [initialProducts]);

  const loadMore = useCallback(async () => {
    if (isFetching || !hasMore) return;
    const offset = fetchedOffsetRef.current;
    setIsFetching(true);
    try {
      const res = await fetch(buildApiUrl(params, offset));
      if (!res.ok) return;
      const newProducts: ShopProduct[] = await res.json();
      if (newProducts.length === 0) {
        setHasMore(false);
        return;
      }
      fetchedOffsetRef.current = offset + newProducts.length;
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...newProducts.filter((p) => !seen.has(p.id))];
      });
      if (newProducts.length < PAGE_SIZE) setHasMore(false);
    } catch {
      // silent — user can scroll back to retry on next intersection
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, hasMore, params]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 4} />
        ))}
      </div>

      {/* Infinite-scroll sentinel + loading indicator */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-8 flex items-center justify-center py-6">
          {isFetching && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Mehr laden…
            </span>
          )}
        </div>
      )}
    </>
  );
}
