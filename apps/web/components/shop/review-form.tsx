'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StarPicker } from './star-display';
import { useSubmitReview } from '@/hooks/use-shop';
import type { ProductReview } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// ReviewForm — nur sichtbar wenn Viewer das Produkt gekauft hat
// (getEligibleOrderForReview returned order_id).
// Prefills mit existing review wenn vorhanden (Update-Semantik).
// -----------------------------------------------------------------------------

export function ReviewForm({
  productId,
  initialReview,
}: {
  productId: string;
  initialReview: ProductReview | null;
}) {
  const [rating, setRating] = useState(initialReview?.rating ?? 0);
  const [comment, setComment] = useState(initialReview?.comment ?? '');
  const submit = useSubmitReview();

  const canSubmit = rating >= 1 && rating <= 5 && !submit.isPending;
  const isEdit = !!initialReview;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submit.mutate({ productId, rating, comment: comment.trim() || null });
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-base font-semibold">
        {isEdit ? 'Deine Bewertung bearbeiten' : 'Produkt bewerten'}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Deine Meinung hilft anderen Käufern. Du kannst deine Bewertung später bearbeiten.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <span className="text-sm text-muted-foreground">{rating} / 5</span>
        )}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Schreib einen kurzen Kommentar (optional)"
        maxLength={1000}
        rows={4}
        className="mt-3 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />
      <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
        {comment.length} / 1000
      </div>

      <Button disabled={!canSubmit} onClick={handleSubmit} className="mt-2 w-full">
        {submit.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isEdit ? (
          'Bewertung aktualisieren'
        ) : (
          'Bewertung abschicken'
        )}
      </Button>
    </div>
  );
}
