'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { MessageCircle, Loader2, Send, Bell, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getOrCreateConversation } from '@/app/actions/messages';
import { markPreordersPayable, notifyPreorderBuyers } from '@/app/actions/shop';
import { formatEur } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// -----------------------------------------------------------------------------
// Vorbestell-Kontakt — zwei Wege, einen Interessenten/alle zu erreichen.
//
// 1) PreorderContactButton: 1:1-DM mit einem Käufer (✉️-Icon pro Person).
// 2) PreorderNotifyAllButton: schreibt ALLEN Interessenten (status='interested')
//    in einem Rutsch dieselbe Nachricht und setzt sie auf 'notified'.
// -----------------------------------------------------------------------------

export function PreorderContactButton({
  buyerId,
  productId,
}: {
  buyerId: string;
  productId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await getOrCreateConversation(buyerId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(`/messages/${res.data.id}?productId=${productId}` as Route);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="grid h-8 w-8 flex-none place-items-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-60"
      aria-label="Anschreiben"
      title="Anschreiben"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
    </button>
  );
}

export function PreorderNotifyAllButton({
  productId,
  title,
  count,
}: {
  productId: string;
  title: string;
  count: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    `Hey! Gute Nachrichten 🎉 Dein vorbestelltes „${title}“ ist bei mir eingetroffen. Du kannst es jetzt bezahlen — danach geht es direkt an dich raus. Meld dich kurz, dann machen wir's klar 🌸`,
  );
  const [isPending, startTransition] = useTransition();

  if (count <= 0) return null;

  const send = () => {
    const msg = message.trim();
    if (!msg) {
      toast.error('Schreib kurz eine Nachricht.');
      return;
    }
    startTransition(async () => {
      const res = await notifyPreorderBuyers(productId, msg);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(
        res.data.notified > 0
          ? `${res.data.notified} ${res.data.notified === 1 ? 'Person' : 'Leute'} angeschrieben 🎉`
          : 'Alle wurden schon benachrichtigt.',
      );
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex flex-none items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Send className="h-3.5 w-3.5" />
        Alle anschreiben
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alle Interessenten anschreiben</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Schreibt allen {count} {count === 1 ? 'Person' : 'Leuten'}, die noch
            nicht benachrichtigt wurden, dieselbe Nachricht als DM. Schon
            benachrichtigte werden übersprungen.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
            {message.length} / 500
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button onClick={send} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `An ${count} senden`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -----------------------------------------------------------------------------
// PreorderRequestPaymentButton — „Ware ist da → Zahlung anfordern".
// Erzeugt aus den Vormerkungen bezahlbare Echtgeld-Bestellungen (mark_preorders_
// payable) und schickt allen die „jetzt bezahlen"-Aufforderung. Braucht einen
// €-Preis am Produkt; fehlt der, zeigt der Button einen Hinweis statt der Aktion.
// -----------------------------------------------------------------------------

export function PreorderRequestPaymentButton({
  productId,
  title,
  priceEur,
  alreadyRequested = false,
  requestedCount = 0,
  peopleCount = 0,
}: {
  productId: string;
  title: string;
  priceEur: number | null;
  alreadyRequested?: boolean;
  /** #1: wie viele Zahlungsanfragen offen sind. */
  requestedCount?: number;
  /** Gesamtzahl Vormerker (für #2/#3: neu = people − angefordert). */
  peopleCount?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [doneLocal, setDoneLocal] = useState(false);
  const [isPending, startTransition] = useTransition();
  // „Angefordert"-Zustand: aus den Daten (offene Zahlungsanfrage) ODER sofort nach Klick.
  const done = alreadyRequested || doneLocal || requestedCount > 0;
  // #2/#3: Vormerker, die noch KEINE Zahlungsanfrage haben (z.B. neu dazu).
  const newCount = Math.max(0, peopleCount - requestedCount);
  const hasNew = done && newCount > 0;

  if (priceEur == null) {
    return (
      <span
        className="inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground"
        title="Setze zuerst einen €-Preis am Produkt (Shop-Studio → Bearbeiten)."
      >
        <Bell className="h-3.5 w-3.5" />
        €-Preis fehlt
      </span>
    );
  }

  const run = () => {
    startTransition(async () => {
      const res = await markPreordersPayable(productId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      setDoneLocal(true);
      toast.success(
        res.data.created === 0 && res.data.skipped > 0
          ? `„${title}“: schon angefordert — ${res.data.skipped} warten auf Zahlung.`
          : `„${title}“: ${res.data.created} Zahlungsaufforderung(en) gesendet` +
              (res.data.skipped > 0 ? `, ${res.data.skipped} schon offen.` : '.'),
      );
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          (done && !hasNew)
            ? 'inline-flex flex-none items-center gap-1.5 rounded-full border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400'
            : 'inline-flex flex-none items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90'
        }
      >
        {(done && !hasNew) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        {!done
          ? 'Ware ist da → Zahlung anfordern'
          : hasNew
            ? 'Erneut anfordern'
            : `Angefordert${requestedCount > 0 ? ` · ${requestedCount}` : ''}`}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zahlung anfordern</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Erzeugt für jede Vormerkung von „{title}“ eine bezahlbare Bestellung
            (je {formatEur(priceEur)}) und schickt allen die „jetzt bezahlen“-
            Aufforderung. Schon offene Bestellungen werden übersprungen.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button onClick={run} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anfordern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
