'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CoinIcon } from '@/components/ui/coin-icon';
import { formatEur } from '@/lib/utils';

// -----------------------------------------------------------------------------
// ProductLinkCard — rendert einen im Chat geteilten Shop-Link (/shop/<id>) als
// kompakte Produktkarte (Cover + Titel + Preis) statt als rohen Text-Link.
// Lädt die Mini-Info client-seitig (RLS erlaubt Lesen aktiver Produkte).
// `bg-background`/`text-foreground` → lesbar in beiden Bubble-Farben (eigen/fremd).
// -----------------------------------------------------------------------------

interface MiniProduct {
  id: string;
  title: string;
  cover_url: string | null;
  price_coins: number;
  sale_price_coins: number | null;
  price_eur: number | null;
  sale_mode: 'coins' | 'preorder' | 'cash' | null;
}

export function ProductLinkCard({
  productId,
  flush = false,
}: {
  productId: string;
  flush?: boolean;
}) {
  const { data, isLoading } = useQuery<MiniProduct | null>({
    queryKey: ['msg-product', productId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id, title, cover_url, price_coins, sale_price_coins, price_eur, sale_mode')
        .eq('id', productId)
        .maybeSingle();
      return (data as MiniProduct | null) ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="mb-1 flex items-center gap-2.5 rounded-lg border border-black/10 bg-background p-2">
        <div className="h-11 w-11 flex-none animate-pulse rounded bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!data) return null; // Produkt gelöscht → Text-Fallback der Bubble bleibt

  const isPreorder = data.sale_mode === 'preorder';
  const eff = data.sale_price_coins ?? data.price_coins;

  return (
    <Link
      href={`/shop/${data.id}` as Route}
      className={`flex items-center gap-2.5 bg-background p-2.5 text-foreground transition-colors hover:bg-muted ${
        flush ? 'w-full rounded-t-2xl' : 'mb-1 rounded-lg border border-black/10'
      }`}
    >
      {data.cover_url ? (
        <Image
          src={data.cover_url}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 flex-none rounded object-cover"
        />
      ) : (
        <div className="grid h-11 w-11 flex-none place-items-center rounded bg-muted">
          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{data.title}</div>
        <div className="mt-0.5 text-xs">
          {isPreorder ? (
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {formatEur(data.price_eur) ?? 'Vorbestellung'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium tabular-nums">
              <CoinIcon className="h-3 w-3" />
              {eff.toLocaleString('de-DE')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
