'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { StarDisplay } from './star-display';
import type { ProductReview } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// ReviewList — fetcht via TanStack Query vom Browser-Client (RLS erlaubt Public-
// Lesen). Keine Pagination — erste 50, für "mehr anzeigen" später.
// -----------------------------------------------------------------------------

function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `vor ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `vor ${diffD} Tg.`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `vor ${diffW} W.`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `vor ${diffMo} Mo.`;
  return `vor ${Math.floor(diffD / 365)} J.`;
}

async function fetchReviews(productId: string): Promise<ProductReview[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('product_reviews')
    .select(
      `id, product_id, reviewer_id, rating, comment, created_at,
       reviewer:profiles!product_reviews_reviewer_id_fkey ( id, username, avatar_url )`,
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data as unknown as (ProductReview & {
    reviewer: ProductReview['reviewer'] | ProductReview['reviewer'][];
  })[]).map((row) => ({
    ...row,
    reviewer: Array.isArray(row.reviewer) ? row.reviewer[0] ?? null : row.reviewer,
  })) as ProductReview[];
}

export function ReviewList({
  productId,
  initialData,
}: {
  productId: string;
  initialData: ProductReview[];
}) {
  const { data: reviews = initialData } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchReviews(productId),
    initialData,
    staleTime: 60_000,
  });

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Noch keine Bewertungen. Sei der/die Erste — kauf das Produkt und hinterlasse eine Bewertung.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-muted">
              {r.reviewer?.avatar_url && (
                <Image src={r.reviewer.avatar_url} alt="" fill className="object-cover" sizes="36px" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                {r.reviewer ? (
                  <Link
                    href={`/u/${r.reviewer.username}` as Route}
                    className="text-sm font-medium hover:underline"
                  >
                    @{r.reviewer.username}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">Gelöschter User</span>
                )}
                <span className="text-xs text-muted-foreground">{formatAgo(r.created_at)}</span>
              </div>
              <div className="mt-1">
                <StarDisplay rating={r.rating} showCount={false} />
              </div>
              {r.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{r.comment}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
