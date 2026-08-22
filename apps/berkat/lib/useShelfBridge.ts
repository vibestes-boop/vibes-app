// Die Brücke zwischen Regal und Show — beide Richtungen.
//
// Regal-Artikel und Show-Artikel liegen in derselben Tabelle; der Unterschied
// ist `session_id` plus `status` (`20260821160000` erklärt es ausführlich).
// Hier stehen die zwei Wege dazwischen und die Liste dessen, was aus einer
// beendeten Sendung übrig geblieben ist.
//
// ⚠️ Beide RPCs VERSCHIEBEN, sie kopieren nicht. Ein Artikel kann nicht
// gleichzeitig im Regal und in der Show liegen — das erzwingt schon
// `live_auctions_shelf_check` auf der Tabelle. Wer hier je ein „kopieren"
// einbaut, bekommt keinen Fehler vom Client, sondern einen Doppelverkauf.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Auction } from './useAuction';

/** Ein Artikel, der in einer beendeten Sendung liegen geblieben ist. */
export type Leftover = Pick<
  Auction,
  'id' | 'title' | 'image_url' | 'status' | 'start_price_cents' | 'buy_now_cents'
> & {
  session_id: string;
  /** Wann die Sendung zu Ende war — für „vom 19.08." in der Zeile. */
  ended_at: string | null;
};

export function shelfBridgeErrorText(message: string): string {
  if (message.includes('women_only_mismatch'))
    return 'Dieser Artikel gehört in den Frauen-Bereich — er kann nur in eine Frauen-Only-Sendung. 🌸';
  if (message.includes('not_on_shelf'))
    return 'Der Artikel liegt nicht mehr im Regal — vielleicht ist er schon verkauft.';
  if (message.includes('not_returnable'))
    return 'Solange die Auktion läuft, geht das nicht. Warte, bis die Uhr durch ist.';
  if (message.includes('show_not_available'))
    return 'Diese Sendung läuft nicht mehr. Leg den Artikel an einen Termin.';
  if (message.includes('plan_not_available'))
    return 'Diesen Termin gibt es nicht mehr. Lad die Seite neu.';
  if (message.includes('too_many_prepared'))
    return 'Fünfzig Artikel sind das Maximum für einen Abend — das reicht für jede Show. 🙂';
  if (message.includes('price_too_low'))
    return 'Der Regalpreis muss über 1 € liegen — der Startpreis für eine spätere Auktion liegt dort.';
  if (message.includes('not_owner')) return 'Das darf nur, wem der Artikel gehört.';
  if (message.includes('listing_not_found')) return 'Den Artikel gibt es nicht mehr.';
  if (message.includes('target_required')) return 'Wähl zuerst, wohin der Artikel soll.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Umzugs-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz — was der Server sagt, steht hier (`useStanding.ts`).
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

/**
 * Beide Wege plus die gemeinsame Invalidierung.
 *
 * ⚠️ Ein Umzug ändert VIER Listen auf einmal: das Regal (Marktplatz und eigenes),
 * die Warteschlange der Show, das Vorbereitete am Termin und die Übrig-Liste.
 * Wer nur eine davon zurücksetzt, sieht denselben Artikel danach an zwei Orten —
 * und weil beide aus dem Zwischenspeicher kommen, sieht das nach einem
 * Doppelverkauf aus, obwohl die Datenbank recht hat.
 */
export function useShelfBridge() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'shop'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'shop-count'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'standing'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'category-listings'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'auctions'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'prepared'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'prepared-mine'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'leftovers'] });
  }, [queryClient]);

  /**
   * Regal → Show. Genau EIN Ziel: laufende Sendung oder Termin.
   *
   * Die Preise müssen dabei nicht angefasst werden — `create_standing_listing`
   * hält `start_price_cents` seit dem 15.08.2026 bei 100 mit genau dieser
   * Begründung, und der Festpreis steht schon als `buy_now_cents` da und wird
   * in der Show zum Sofortkauf.
   */
  const toShow = useMutation({
    mutationFn: async (input: { id: string; sessionId?: string; planId?: string }) => {
      const { error } = await supabase.rpc('move_listing_to_show', {
        p_id: input.id,
        p_session_id: input.sessionId ?? null,
        p_planned_for: input.planId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Show → Regal. Der Preis kommt vom Menschen, nicht aus `buy_now_cents`. */
  const toShelf = useMutation({
    mutationFn: async (input: { id: string; priceCents: number }) => {
      const { error } = await supabase.rpc('move_auction_to_shelf', {
        p_id: input.id,
        p_price_cents: input.priceCents,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { toShow, toShelf, invalidate };
}

/**
 * Was aus beendeten Sendungen übrig ist — „kein Gebot" und „nie drangekommen".
 *
 * ⚠️ Zwei Abfragen statt eines Embeds, und zwar mit Absicht. `live_auctions`
 * hat drei Fremdschlüssel auf `profiles` und einen auf `live_sessions`; löst
 * ein Embed nicht auf, antwortet PostgREST mit einer LEEREN MENGE statt einem
 * Fehler (HANDOFF 3), und die Liste wäre still leer statt sichtbar kaputt.
 * Dieselbe Entscheidung wie in `useShowEarnings`.
 *
 * Gefiltert wird auf BEENDETE Sendungen: Ein Artikel, der in der gerade
 * laufenden Show noch in der Warteschlange steht, ist nicht „übrig" — ihn hier
 * anzubieten wäre eine Einladung, sich versehentlich die eigene Ware
 * wegzuräumen, während das Publikum darauf wartet.
 */
export function useLeftovers(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['berkat', 'leftovers', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Leftover[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, status, start_price_cents, buy_now_cents, session_id')
        .eq('seller_id', userId as string)
        .not('session_id', 'is', null)
        .in('status', ['unsold', 'scheduled'])
        .order('updated_at', { ascending: false })
        .limit(60);
      if (error) throw error;

      const rows = (data ?? []) as unknown as Leftover[];
      if (rows.length === 0) return [];

      const sessionIds = Array.from(new Set(rows.map((r) => r.session_id)));
      const { data: sessions, error: sErr } = await supabase
        .from('live_sessions')
        .select('id, status, ended_at')
        .in('id', sessionIds)
        .eq('status', 'ended');
      if (sErr) throw sErr;

      const endedAt = new Map<string, string | null>(
        (sessions ?? []).map((s: { id: string; ended_at: string | null }) => [s.id, s.ended_at]),
      );
      return rows
        .filter((r) => endedAt.has(r.session_id))
        .map((r) => ({ ...r, ended_at: endedAt.get(r.session_id) ?? null }));
    },
  });
}
