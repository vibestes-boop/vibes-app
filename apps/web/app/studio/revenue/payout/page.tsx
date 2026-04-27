'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowLeft,
  Gem,
  CreditCard,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Euro,
} from 'lucide-react';
import { requestPayout, getMyPayoutRequests, type PayoutRequest } from '@/app/actions/payout';
import { getCreatorEarnings } from '@/lib/data/studio';

// -----------------------------------------------------------------------------
// /studio/revenue/payout — v1.w.UI.157
//
// Parität zu mobile `app/creator/payout-request.tsx`.
//
// Zeigt:
//   1. Aktuellen Diamanten-Balance + Euro-Äquivalent
//   2. Formular: IBAN oder PayPal + optionale Notiz
//   3. Vergangene Auszahlungsanfragen (Status-Badge)
//
// Gating: Nur zugänglich wenn diamonds_balance >= MIN_PAYOUT (2.500 💎 ≈ 50 €).
// Bei offenem Request wird das Formular deaktiviert.
//
// Client-Component weil wir reaktiven Form-State brauchen (method-Switch,
// Validation-Feedback, Pending-Toast). Daten werden über Server-Actions
// geladen / geschrieben.
// -----------------------------------------------------------------------------

const MIN_PAYOUT = 2_500;
const RATE       = 0.02;

const STATUS_LABEL: Record<PayoutRequest['status'], string> = {
  pending:    'Ausstehend',
  processing: 'In Bearbeitung',
  paid:       'Ausgezahlt',
  rejected:   'Abgelehnt',
};

const STATUS_COLOR: Record<PayoutRequest['status'], string> = {
  pending:    'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  processing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  paid:       'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected:   'bg-rose-500/15 text-rose-500',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function PayoutPage() {
  const [balance, setBalance]           = useState<number | null>(null);
  const [pastRequests, setPastRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading]           = useState(true);

  const [method,    setMethod]    = useState<'iban' | 'paypal'>('iban');
  const [iban,      setIban]      = useState('');
  const [paypal,    setPaypal]    = useState('');
  const [note,      setNote]      = useState('');
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [pending,   startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const [earnings, requests] = await Promise.all([
        getCreatorEarnings(28),
        getMyPayoutRequests(),
      ]);
      setBalance(earnings?.diamondsBalance ?? 0);
      setPastRequests(requests);
      setLoading(false);
    }
    load();
  }, [success]);

  const euroAmount = balance !== null ? (balance * RATE).toFixed(2) : '–';
  const eligible = (balance ?? 0) >= MIN_PAYOUT;
  const hasPending = pastRequests.some(
    (r) => r.status === 'pending' || r.status === 'processing',
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('balance', String(balance ?? 0));
    startTransition(async () => {
      const result = await requestPayout(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setIban('');
      setPaypal('');
      setNote('');
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-0">
      {/* Back */}
      <Link
        href={'/studio/revenue' as Route}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      <h1 className="mb-1 text-2xl font-semibold">Auszahlung beantragen</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Deine Diamanten werden manuell bearbeitet und per SEPA oder PayPal ausgezahlt.
        Der Mindestauszahlungsbetrag beträgt {MIN_PAYOUT.toLocaleString('de-DE')} 💎 (≈ {(MIN_PAYOUT * RATE).toFixed(0)} €).
      </p>

      {/* Balance Card */}
      <div className="mb-6 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <Gem className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dein Diamanten-Guthaben</p>
            {loading ? (
              <div className="mt-1 h-6 w-32 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-bold">
                {(balance ?? 0).toLocaleString('de-DE')} 💎
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ≈ {euroAmount} €
                </span>
              </p>
            )}
          </div>
        </div>

        {!loading && !eligible && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Du hast noch nicht genug Diamanten für eine Auszahlung. Dir fehlen noch{' '}
              <strong>{(MIN_PAYOUT - (balance ?? 0)).toLocaleString('de-DE')} 💎</strong>.
            </span>
          </div>
        )}
      </div>

      {/* Success */}
      {success ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
          <div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">Anfrage eingegangen!</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Deine Auszahlungsanfrage wurde erfolgreich gesendet. Wir bearbeiten sie manuell
              und melden uns per E-Mail sobald die Überweisung ausgelöst wurde (in der Regel 3–5 Werktage).
            </p>
          </div>
        </div>
      ) : (
        /* Form */
        <form onSubmit={onSubmit} className="mb-8 rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Zahlungsdetails</h2>

          {/* Method toggle */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMethod('iban')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                method === 'iban'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              SEPA / IBAN
            </button>
            <button
              type="button"
              onClick={() => setMethod('paypal')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                method === 'paypal'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Mail className="h-4 w-4" />
              PayPal
            </button>
          </div>

          <input type="hidden" name="method" value={method} />

          {method === 'iban' ? (
            <div className="mb-4">
              <label htmlFor="payout-iban" className="mb-1.5 block text-sm font-medium">
                IBAN <span className="text-rose-500">*</span>
              </label>
              <input
                id="payout-iban"
                name="iban"
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value.replace(/\s/g, ''))}
                placeholder="DE89 3704 0044 0532 0130 00"
                required
                className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Die IBAN wird niemals öffentlich gespeichert — nur für die einmalige Überweisung verwendet.
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <label htmlFor="payout-paypal" className="mb-1.5 block text-sm font-medium">
                PayPal-E-Mail <span className="text-rose-500">*</span>
              </label>
              <input
                id="payout-paypal"
                name="paypal_email"
                type="email"
                value={paypal}
                onChange={(e) => setPaypal(e.target.value)}
                placeholder="deine@paypal.com"
                required
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* Note */}
          <div className="mb-4">
            <label htmlFor="payout-note" className="mb-1.5 block text-sm font-medium">
              Notiz{' '}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="payout-note"
              name="note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. bevorzugter Auszahlungszeitraum"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Payout summary */}
          {eligible && (
            <div className="mb-4 rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Auszahlungsbetrag</span>
                <span className="font-semibold">
                  {(balance ?? 0).toLocaleString('de-DE')} 💎 = <span className="text-emerald-600 dark:text-emerald-400">{euroAmount} €</span>
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                70% Gift-Anteil nach Serlo-Gebühren. Steuerlich als Einnahme zu deklarieren.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {hasPending && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              Du hast bereits eine offene Auszahlungsanfrage. Warte bis diese bearbeitet wurde.
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !eligible || hasPending || loading}
            className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird gesendet…
              </>
            ) : (
              <>
                <Euro className="h-4 w-4" />
                Auszahlung beantragen
              </>
            )}
          </button>
        </form>
      )}

      {/* Past requests */}
      {pastRequests.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Meine Anfragen</h2>
          <ul className="overflow-hidden rounded-xl border bg-card">
            {pastRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {r.diamonds_amount.toLocaleString('de-DE')} 💎 → {r.euro_amount.toFixed(2)} €
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.iban ? `IBAN: ${r.iban.slice(0, 8)}…` : `PayPal: ${r.paypal_email}`}
                    {' · '}
                    {formatDate(r.created_at)}
                  </p>
                  {r.admin_note && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Admin: {r.admin_note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
