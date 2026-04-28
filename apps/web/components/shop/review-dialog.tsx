'use client';

import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReviewForm } from './review-form';
import { useMyReview } from '@/hooks/use-shop';

// -----------------------------------------------------------------------------
// ReviewDialog — Bestellhistorie-Bewertungs-CTA (v1.w.UI.233)
//
// Parity mit native app/shop/orders.tsx ReviewSheet + useMyReview.
// Trigger-Button zeigt bestehende Rating-Sterne an (falls vorhanden) oder
// „Bewerten"-Text. Öffnet Dialog mit ReviewForm (Upsert-Semantik).
// Nur rendern wenn canReview (status === 'completed').
// -----------------------------------------------------------------------------

export function ReviewDialog({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const { data: myReview, isLoading } = useMyReview(open ? productId : null);

  const hasReview = !!myReview;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-gold/40 bg-brand-gold/8 px-3 py-1.5 text-xs font-medium text-brand-gold transition-colors hover:bg-brand-gold/15"
      >
        {hasReview ? (
          <>
            <Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" />
            {'★'.repeat(myReview.rating)}
          </>
        ) : (
          <>
            <Star className="h-3.5 w-3.5" />
            Bewerten
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasReview ? 'Bewertung bearbeiten' : 'Produkt bewerten'}
            </DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ReviewForm
              productId={productId}
              initialReview={myReview ?? null}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
