'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { submitOrderReview } from '@/app/actions/shop';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { OrderReview } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// OrderReviewControl — Bewertung einer gelieferten Echtgeld-Bestellung.
// Beidseitig: Käufer bewertet Verkäufer, Verkäufer bewertet Käufer. Zeigt die
// eigene (änderbare) Bewertung + die von der Gegenseite erhaltene.
// -----------------------------------------------------------------------------

function Stars({
  value,
  onChange,
  size = 'h-5 w-5',
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n} Sterne`}
        >
          <Star className={`${size} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
        </button>
      ))}
    </div>
  );
}

export function OrderReviewControl({
  orderId,
  role,
  myReview,
  receivedReview,
}: {
  orderId: string;
  role: 'buyer' | 'seller';
  myReview: OrderReview | null;
  receivedReview: OrderReview | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? '');
  const [isPending, startTransition] = useTransition();

  const targetLabel = role === 'seller' ? 'Käufer' : 'Verkäufer';

  const submit = () => {
    if (rating < 1) {
      toast.error('Bitte 1–5 Sterne wählen.');
      return;
    }
    startTransition(async () => {
      const r = await submitOrderReview(orderId, rating, comment);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setOpen(false);
      toast.success('Bewertung gespeichert ⭐');
      router.refresh();
    });
  };

  const openDialog = () => {
    setRating(myReview?.rating ?? 0);
    setComment(myReview?.comment ?? '');
    setOpen(true);
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        {myReview ? (
          <>
            <Stars value={myReview.rating} />
            <button onClick={openDialog} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Bewertung ändern
            </button>
          </>
        ) : (
          <button
            onClick={openDialog}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Star className="h-3.5 w-3.5" />
            {targetLabel} bewerten
          </button>
        )}
      </div>

      {receivedReview && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 pt-0.5">Du wurdest bewertet:</span>
          <span className="flex flex-col gap-0.5">
            <Stars value={receivedReview.rating} size="h-3.5 w-3.5" />
            {receivedReview.comment && <span className="italic">„{receivedReview.comment}“</span>}
          </span>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{targetLabel} bewerten</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <Stars value={rating} onChange={setRating} size="h-8 w-8" />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Optional: ein paar Worte zur Bestellung…"
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button onClick={submit} disabled={isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
