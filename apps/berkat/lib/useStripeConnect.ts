// Geld empfangen — der Verkäufer verbindet sein eigenes Stripe-Konto.
//
// WARUM ES DAS GIBT
// Bis heute läuft jeder Euro über das Stripe-Konto des Betreibers. Beim zweiten
// Verkäufer wäre das Finanztransfergeschäft und nach ZAG erlaubnispflichtig
// (Übergabe 20). Zaurs Entscheidung vom 27.08.2026: Der Käufer zahlt **direkt
// an den Verkäufer** — Connect Standard, Bürgen statt Käuferschutz (Übergabe 96).
//
// ⚠️ DIESE DATEI ENTSCHEIDET NICHTS.
// Ob ein Verkäufer kassieren darf, sagt `berkat_sellers.checkout_enabled`, und
// das pflegt seit `20260827100000` ein Trigger aus Stripes `charges_enabled`.
// Hier wird nur angezeigt und angestossen — dieselbe Arbeitsteilung wie überall
// im Geldnahen: „Der Server entscheidet, der Client zeigt an" (Übergabe 4).

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { errText } from './errorText';
import { openPaymentPage } from './payBrowser';

/**
 * `none` — noch nie begonnen · `incomplete` — angefangen, nicht abgegeben ·
 * `pending` — abgegeben, Stripe prüft · `ready` — kann Geld empfangen.
 *
 * ⚠️ `pending` und `ready` auseinanderzuhalten ist der Zweck dieses Typs.
 * Stripe prüft nach der Abgabe weiter; bei Rückfragen bleibt `charges_enabled`
 * false, obwohl der Verkäufer das Formular ausgefüllt hat. Ein blosses Ja/Nein
 * würde ihm sagen „fertig", während bei ihm niemand kaufen kann.
 */
export type StripeConnectState = 'none' | 'incomplete' | 'pending' | 'ready';

const KEY = ['berkat', 'stripe-connect'] as const;

export function useStripeConnectState(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: Boolean(userId),
    // Kein `staleTime: Infinity` wie bei der Altersschranke: Dieser Wert ändert
    // sich, während der Nutzer zusieht — Stripe gibt Minuten nach der Abgabe
    // frei, und der Webhook trägt es nach.
    staleTime: 30_000,
    queryFn: async (): Promise<StripeConnectState> => {
      const { data, error } = await supabase.rpc('get_my_stripe_connect');
      if (error) throw error;
      const state = (data as { state?: string } | null)?.state;
      return (state as StripeConnectState) ?? 'none';
    },
  });
}

/**
 * Startet oder setzt das Onboarding fort und holt danach den Stand nach.
 *
 * Der Rückgabewert sagt bewusst NICHT, ob es geklappt hat — das weiss nur
 * Stripe. „Blatt zu" heisst hier ausschliesslich: Der Nutzer ist wieder bei uns
 * (dieselbe Zusage wie `openPaymentPage`).
 */
export function useStartStripeConnect(userId: string | null) {
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    // ⚠️ Direkt bei Stripe nachfragen statt nur die Abfrage zu verwerfen: Der
    // Webhook `account.updated` ist der Hauptweg, aber unmittelbar nach der
    // Rückkehr kann er noch unterwegs sein. Ein Verkäufer, der gerade fertig
    // geworden ist und „nicht eingerichtet" liest, glaubt an einen Fehler.
    try {
      await supabase.functions.invoke('stripe-connect-onboard', {
        body: { action: 'refresh' },
      });
    } catch {
      // Das Netz ist hier nur die Abkürzung. Fällt sie aus, trägt der Webhook
      // den Stand nach — deshalb kein Fehler nach aussen.
    }
    await qc.invalidateQueries({ queryKey: [...KEY, userId] });
  }, [qc, userId]);

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: { action: 'link' },
      });
      if (error) throw new Error(errText(error));

      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('Stripe hat keinen Link geschickt.');

      // Dasselbe Blatt wie die Kasse: „Fertig" oben statt „Schließen", und die
      // Leiste klappt nicht ein — Stripes Onboarding ist ein langes Formular,
      // und in der Leiste sitzt der einzige Weg zurück.
      await openPaymentPage(url);
      await refresh();
    },
  });

  return { start: mutation.mutateAsync, isStarting: mutation.isPending, refresh };
}

/** Ein Satz für die Zeile im Konto — knapp, und er sagt, was als Nächstes gilt. */
export function stripeConnectLabel(state: StripeConnectState): {
  text: string;
  tone: 'warn' | 'muted' | 'ok';
} {
  switch (state) {
    case 'ready':
      return { text: 'bereit', tone: 'ok' };
    case 'pending':
      return { text: 'Stripe prüft', tone: 'muted' };
    case 'incomplete':
      return { text: 'unvollständig', tone: 'warn' };
    default:
      return { text: 'nicht eingerichtet', tone: 'warn' };
  }
}
