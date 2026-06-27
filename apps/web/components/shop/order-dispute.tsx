'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { reportOrderDispute, resolveOrderDispute } from '@/app/actions/shop';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { OrderDispute } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// OrderDisputeControl — Problem an einer Bestellung melden (Käufer/Verkäufer) +
// Klärung durch Admin. Sichtbar ab Bezahlung (paid/shipped/delivered).
// -----------------------------------------------------------------------------

const REASONS: { value: string; label: string; role?: 'buyer' | 'seller' }[] = [
  { value: 'not_received', label: 'Ware nicht erhalten', role: 'buyer' },
  { value: 'damaged', label: 'Ware beschädigt', role: 'buyer' },
  { value: 'not_as_described', label: 'Nicht wie beschrieben', role: 'buyer' },
  { value: 'not_paid', label: 'Käufer zahlt nicht', role: 'seller' },
  { value: 'fraud', label: 'Betrugsverdacht' },
  { value: 'other', label: 'Sonstiges' },
];
const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));

export function OrderDisputeControl({
  orderId,
  role,
  dispute,
  isAdmin,
}: {
  orderId: string;
  role: 'buyer' | 'seller';
  dispute: OrderDispute | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [isPending, startTransition] = useTransition();

  const options = REASONS.filter((r) => !r.role || r.role === role);

  const report = () => {
    if (!reason) { toast.error('Bitte einen Grund wählen.'); return; }
    startTransition(async () => {
      const r = await reportOrderDispute(orderId, reason, detail);
      if (!r.ok) { toast.error(r.error); return; }
      setOpen(false);
      toast.success('Problem gemeldet — wir kümmern uns drum.');
      router.refresh();
    });
  };

  const resolve = () => {
    if (!dispute) return;
    startTransition(async () => {
      const r = await resolveOrderDispute(dispute.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success('Als geklärt markiert ✓');
      router.refresh();
    });
  };

  if (dispute) {
    const isOpen = dispute.status === 'open';
    return (
      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {isOpen ? `In Klärung: ${REASON_LABEL[dispute.reason] ?? dispute.reason}` : 'Streit geklärt ✓'}
        </div>
        {isAdmin && isOpen && (
          <button
            onClick={resolve}
            disabled={isPending}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            <ShieldCheck className="h-3 w-3" />
            Als geklärt markieren
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => { setReason(''); setDetail(''); setOpen(true); }}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Problem melden
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Problem melden</DialogTitle>
          </DialogHeader>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Grund wählen…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Was ist passiert? (optional)"
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Abbrechen</Button>
            <Button onClick={report} disabled={isPending}>Melden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
