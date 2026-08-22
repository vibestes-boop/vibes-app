// Ein Problem mit einer Bestellung melden.
//
// ⚠️ SERVERSEITE WAR SCHON DA. `order_disputes` samt zwei RPCs, Lese-Policy und
// Benachrichtigungen liegt seit dem 28.06.2026 in der Datenbank (Migration
// `20260628110000`, von Serlo) — und hängt an `product_orders`, also an genau
// der Tabelle, in die Berkats Kasse schreibt. Berkats Bestellungen waren damit
// streitfähig, ohne dass es je jemand benutzt hat.
//
// Dieselbe Klasse wie `messages.image_url` (Übergabe 65): Die Kette ist an jedem
// Glied vollständig außer am letzten. Die Probe bleibt dieselbe — zeig mir den
// Bildschirm, auf dem dieser Wert steht.
//
// ⚠️ WAS DIESER WEG VERSPRICHT, UND WAS NICHT.
// Er verspricht einen **Vorgang**, kein Geld: Der Fall bekommt eine Nummer,
// einen Grund, einen Text und einen Zustand. Über Erstattung sagt er nichts —
// das ist die Käuferschutz-Zusage, und die steht bewusst auf Fassung A
// (`STRATEGIE-VERKAEUFER-UND-GELD.md`, Abschnitt 8): kein Versprechen über die
// gesetzliche Pflicht hinaus, solange Zaur der einzige Verkäufer ist.
//
// Wer die Beschriftung je auf „Geld zurück" ändert, ändert damit eine
// Rechtsfrage und nicht einen Text.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

/** Gespiegelt aus dem CHECK-Constraint auf `order_disputes.reason`. */
export type DisputeReason =
  | 'not_received'
  | 'damaged'
  | 'not_as_described'
  | 'not_paid'
  | 'fraud'
  | 'other';

/**
 * Die Gründe, die ein KÄUFER angibt.
 *
 * `not_paid` fehlt mit Absicht — das ist der Vorwurf des Verkäufers, und ein
 * Käufer, der ihn in seiner Liste findet, versteht die Liste falsch. Der Server
 * kennt ihn weiterhin; hier steht nur, was an dieser Stelle Sinn ergibt.
 */
export const BUYER_DISPUTE_REASONS: { key: DisputeReason; label: string }[] = [
  { key: 'not_received', label: 'Kam nie an' },
  { key: 'damaged', label: 'Kam beschädigt an' },
  { key: 'not_as_described', label: 'War nicht wie beschrieben' },
  { key: 'fraud', label: 'Ich vermute Betrug' },
  { key: 'other', label: 'Etwas anderes' },
];

export type DisputeStatus = 'open' | 'resolved' | 'dismissed';

export type MyDispute = {
  id: string;
  reason: DisputeReason;
  detail: string | null;
  /** Belegfoto des Melders (seit `20260821180000`). */
  image_url: string | null;
  status: DisputeStatus;
  resolution: string | null;
  created_at: string;
};

export function disputeErrorText(code: string): string {
  if (code.includes('order_not_found')) return 'Diese Bestellung gibt es nicht mehr.';
  if (code.includes('not_participant')) return 'Das kann nur, wer an der Bestellung beteiligt ist.';
  if (code.includes('bad_reason')) return 'Wähl zuerst einen Grund.';
  if (code.includes('bad_image')) return 'Das Foto ließ sich nicht anhängen. Probier es noch mal.';
  // Der Server lässt nur `paid`, `shipped` und `delivered` zu — vorher gibt es
  // nichts zu beanstanden, und danach ist es kein offener Vorgang mehr.
  if (code.includes('bad_status'))
    return 'Zu dieser Bestellung lässt sich gerade nichts melden — sie ist noch nicht bezahlt oder schon abgeschlossen.';
  if (code.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (code.includes('does not exist') || code.includes('PGRST202'))
    return 'Die Melde-Funktion fehlt noch in der Datenbank.';
  return code ? `Der Server sagt: ${code}` : 'Das hat nicht geklappt.';
}

/**
 * Mein eigener Fall zu dieser Bestellung — oder keiner.
 *
 * ⚠️ Gefiltert auf `reporter_id`, obwohl die Policy schon beide Seiten
 * durchlässt: Der Verkäufer darf denselben Vorgang sehen, aber auf DIESEM
 * Bildschirm geht es um „habe ICH gemeldet". Ohne den Filter zeigte die
 * Käuferseite den Fall, den der Verkäufer gegen sie eröffnet hat, als ihren
 * eigenen.
 */
export function useMyDispute(orderId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'dispute', orderId, userId],
    enabled: Boolean(orderId && userId),
    staleTime: 15_000,
    queryFn: async (): Promise<MyDispute | null> => {
      const { data, error } = await supabase
        .from('order_disputes')
        .select('id, reason, detail, image_url, status, resolution, created_at')
        .eq('order_id', orderId!)
        .eq('reporter_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MyDispute | null) ?? null;
    },
  });
}

export function useReportDispute(orderId: string | undefined, userId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'dispute', orderId, userId] });
  }, [queryClient, orderId, userId]);

  return useMutation({
    mutationFn: async (input: {
      reason: DisputeReason;
      detail: string | null;
      imageUrl?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('report_order_dispute', {
        p_order_id: orderId!,
        p_reason: input.reason,
        p_detail: input.detail,
        p_image_url: input.imageUrl ?? null,
      });
      if (error) throw new Error(error.message);
      // ⚠️ Die RPC wirft nicht, sie ANTWORTET mit `{ error: '…' }`. Wer nur auf
      // `error` von supabase-js prüft, hält jeden abgelehnten Fall für
      // erfolgreich — und der Käufer glaubt, sein Problem sei gemeldet.
      const res = (data ?? {}) as { success?: boolean; error?: string };
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: invalidate,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Die VERKÄUFER-Seite. Whatnots Bilder zeigen genau diese Hälfte: den Fall
// ansehen und darauf reagieren (elfte Analyse). Bis zum 21.08.2026 gab es in
// Berkat nur die Melde-Hälfte — der Verkäufer bekam eine rote Meldung und
// landete auf einer Bestellliste, die von dem Fall nichts wusste.
// ─────────────────────────────────────────────────────────────────────────────

/** Ein Fall, der gegen MICH läuft — mit dem, was der Melder angegeben hat. */
export type IncomingDispute = MyDispute & { order_id: string; reporter_id: string };

/**
 * Offene Fälle zu meinen Bestellungen.
 *
 * ⚠️ Eine Abfrage für die ganze Liste, nicht eine je Bestellung. Bei zwanzig
 * Bestellungen wären das zwanzig Rundgänge für etwas, das fast immer leer ist —
 * dieselbe Kostenhygiene wie beim Posteingang.
 *
 * Gefiltert auf `against_id`: Das ist die Seite, gegen die gemeldet wurde. Die
 * Policy ließe auch die eigenen Meldungen durch, aber auf DIESEM Bildschirm
 * geht es um „was liegt gegen mich vor".
 */
export function useIncomingDisputes(orderIds: string[], userId: string | null) {
  const key = orderIds.join(',');
  return useQuery({
    queryKey: ['berkat', 'disputes-against', key, userId],
    enabled: Boolean(userId) && orderIds.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<Map<string, IncomingDispute>> => {
      const { data, error } = await supabase
        .from('order_disputes')
        .select('id, order_id, reporter_id, reason, detail, image_url, status, resolution, created_at')
        .in('order_id', orderIds)
        .eq('against_id', userId!)
        .eq('status', 'open');
      if (error) throw error;
      const map = new Map<string, IncomingDispute>();
      for (const row of (data ?? []) as IncomingDispute[]) map.set(row.order_id, row);
      return map;
    },
  });
}

/**
 * Was mich mit diesem Käufer verbindet — und NUR das.
 *
 * ⚠️ Whatnot zeigt an dieser Stelle „Lifetime Spend · Refunds · Cancellations",
 * also das Verhalten der Person auf der ganzen Plattform. Das ist für Berkat
 * die falsche Übernahme: In einer engen Gemeinschaft ist „diese Person hat
 * dreimal Geld zurückverlangt" kein Datenpunkt, sondern **Gerede** — Whatnots
 * Käufer sind einander fremd, Berkats kennen sich womöglich.
 *
 * Deshalb nur die Beziehung zu MIR: wie oft bei mir gekauft, für wie viel, wie
 * oft es dabei ein Problem gab. Das beantwortet die Frage, die der Verkäufer in
 * diesem Moment wirklich hat — „kenne ich den?" — ohne ein Urteil über einen
 * Menschen weiterzureichen, das ihm anderswo anhängt.
 */
export function useBuyerRelation(buyerId: string | undefined, sellerId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'buyer-relation', buyerId, sellerId],
    enabled: Boolean(buyerId && sellerId),
    staleTime: 60_000,
    queryFn: async (): Promise<{ orders: number; cents: number; disputes: number }> => {
      const { data } = await supabase
        .from('product_orders')
        .select('id, amount_eur')
        .eq('seller_id', sellerId!)
        .eq('buyer_id', buyerId!)
        .in('status', ['paid', 'shipped', 'delivered']);
      const rows = (data ?? []) as { id: string; amount_eur: string }[];
      const cents = rows.reduce((sum, r) => sum + Math.round(Number(r.amount_eur) * 100), 0);

      const { count } = await supabase
        .from('order_disputes')
        .select('id', { count: 'exact', head: true })
        .eq('against_id', sellerId!)
        .eq('reporter_id', buyerId!);

      return { orders: rows.length, cents, disputes: count ?? 0 };
    },
  });
}

/** Bin ich Betreiber? Nur der darf einen Fall schließen. */
export function useIsAdmin(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'is-admin', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) return false;
      return Boolean(data);
    },
  });
}

/**
 * Einen Fall schließen.
 *
 * ⚠️ NUR der Betreiber. `resolve_order_dispute` prüft `is_admin()` und antwortet
 * sonst mit `not_authorized`. Das ist richtig so und bleibt: Ein Verkäufer, der
 * die Beanstandung gegen sich selbst als erledigt markieren kann, ist keine
 * Schlichtung, sondern ein Knopf zum Wegwischen.
 *
 * Deshalb steht der Knopf im Client auch nur für Admins da — einen anzubieten,
 * den der Server ablehnt, ist eine Einladung ins Leere (Übergabe 22).
 */
export function useResolveDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; resolution: string | null; dismiss?: boolean }) => {
      const { data, error } = await supabase.rpc('resolve_order_dispute', {
        p_dispute_id: input.id,
        p_resolution: input.resolution,
        p_dismiss: input.dismiss ?? false,
      });
      if (error) throw new Error(error.message);
      const res = (data ?? {}) as { success?: boolean; error?: string };
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'disputes-against'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'dispute'] });
    },
  });
}

/** Der Grund als Satz — dieselben Worte, die der Käufer angetippt hat. */
export function disputeReasonLabel(reason: DisputeReason): string {
  const found = BUYER_DISPUTE_REASONS.find((r) => r.key === reason);
  if (found) return found.label;
  return reason === 'not_paid' ? 'Nicht bezahlt' : 'Problem';
}

/**
 * Der offene Fall zwischen mir und genau dieser Person — für den Chat.
 *
 * ⚠️ WARUM ALS KARTE IM CHAT UND NICHT ALS NACHRICHT.
 * Whatnot zeigt den Support Request als Karte im Nachrichtenstrom (elfte
 * Analyse): Überschrift, Grund, Zitat, Position, Beleg. Der naheliegende Weg
 * wäre, beim Melden eine Nachricht mit diesem Inhalt zu SCHREIBEN. Drei Gründe
 * dagegen:
 *
 *   1. `messages` gehört Serlo mit. Eine Nachricht mit Sonderbedeutung wäre
 *      dort roher Text — oder schlimmer, eine leere Blase.
 *   2. Eine geschriebene Nachricht friert ein. Ändert der Melder seinen Grund
 *      oder wird der Fall geschlossen, steht die alte Fassung für immer im
 *      Verlauf und widerspricht dem Vorgang.
 *   3. Sie scrollt weg. In einer Unterhaltung, die GENAU VON DIESEM FALL
 *      handelt, gehört er dauerhaft in Sicht.
 *
 * Deshalb: Der Chat schlägt den Fall selbst nach und zeichnet ihn oben. Er
 * verschwindet von allein, sobald der Fall geschlossen ist.
 *
 * ⚠️ Zwei Abfragen statt eines Embeds — `order_disputes → product_orders`
 * aufzulösen wäre kürzer, aber ein nicht auflösender Embed antwortet mit einer
 * LEEREN MENGE statt einem Fehler (Übergabe, Abschnitt 3). Hier wäre der
 * Ausfall still: Der Fall verschwände aus dem Chat, und niemand wüsste warum.
 */
export function useDisputeWith(otherId: string | undefined, myUserId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'dispute-with', otherId, myUserId],
    enabled: Boolean(otherId && myUserId),
    staleTime: 15_000,
    queryFn: async (): Promise<
      | (IncomingDispute & { orderTitle: string | null; amountCents: number; iReported: boolean })
      | null
    > => {
      const { data, error } = await supabase
        .from('order_disputes')
        .select('id, order_id, reporter_id, reason, detail, image_url, status, resolution, created_at')
        // Beide Richtungen: Der Fall kann von mir oder gegen mich sein — im
        // Chat ist er in beiden Fällen dasselbe Gespräch.
        .or(
          `and(reporter_id.eq.${myUserId},against_id.eq.${otherId}),` +
            `and(reporter_id.eq.${otherId},against_id.eq.${myUserId})`,
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const row = data as IncomingDispute | null;
      if (!row) return null;

      const { data: order } = await supabase
        .from('product_orders')
        .select('title, amount_eur')
        .eq('id', row.order_id)
        .maybeSingle();
      const o = order as { title: string | null; amount_eur: string } | null;

      return {
        ...row,
        orderTitle: o?.title ?? null,
        amountCents: o ? Math.round(Number(o.amount_eur) * 100) : 0,
        iReported: row.reporter_id === myUserId,
      };
    },
  });
}

/**
 * „Heute 13:36" / „21.08. 13:36" — der genaue Zeitpunkt.
 *
 * ⚠️ Nicht „vor 2 Std". Eine Beanstandung ist der einzige Vorgang in Berkat mit
 * einer FRIST: Der Käufer wartet, und wie lange schon, ist die Auskunft, die
 * der Verkäufer braucht. „vor 2 Std" rundet, veraltet still und lässt sich
 * nicht zitieren — wer später sagt „ich habe am selben Tag geantwortet", will
 * eine Uhrzeit, keine Spanne.
 */
export function disputeWhen(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const time = then.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return `Heute ${time}`;
  return `${then.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
}

/**
 * Die Bestellnummer, wie sie überall in Berkat aussieht.
 *
 * Eine UUID ist nicht vorlesbar; die ersten acht Zeichen benennen eine
 * Bestellung eindeutig und passen in eine Zeile. Dieselbe Kürzung wie auf der
 * Bestellseite — wer beide nebeneinander hält, muss dieselbe Zeichenfolge
 * sehen, sonst ist sie als Bezug wertlos.
 */
export function orderRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
