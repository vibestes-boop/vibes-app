// Artikel für eine angekündigte Show vorbereiten.
//
// DAS PROBLEM, DAS DAS LÖST
// `create_live_auction` verlangt eine `live_sessions`-ID, und die entsteht erst
// beim Live-Gehen. Ein Verkäufer stand deshalb vor der Kamera, vor Publikum, und
// tippte dort Titel, Startpreis und Mindestschritt — tote Sendezeit bei jedem
// einzelnen Artikel. Und die „Demnächst"-Karte hatte nichts zu zeigen außer
// Titel und Bild: kein Grund, pünktlich zu sein, weil niemand wusste, was kommt.
//
// ⚠️ EIN VORBEREITETER ARTIKEL IST TECHNISCH EIN DAUERANGEBOT
// Keine neue Tabelle, keine Geisterzeile in `live_sessions` — eine
// `live_auctions`-Zeile ohne Session. Unterschieden wird über `status`:
//
//   session_id NULL + 'listed'    → Dauerangebot, liegt im Regal
//   session_id NULL + 'scheduled' → für eine Show vorbereitet   ← hier
//   session_id gesetzt            → in der Show
//
// Deshalb kollidiert nichts: `shelfQuery` in `useListings.ts` filtert auf
// `status = 'listed'`, ein vorbereiteter Artikel taucht im Regal also nicht auf,
// ohne dass dort eine Zeile geändert werden musste. Die lange Begründung, warum
// der naheliegende Weg (`live_sessions.status = 'planned'`) verworfen wurde,
// steht in HANDOFF 41 und im Kopf von `20260819110000`.

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type PreparedAuction = {
  id: string;
  /** Der Termin, für den er vorbereitet ist. */
  planned_for: string | null;
  seller_id: string;
  title: string;
  image_url: string | null;
  start_price_cents: number;
  min_increment_cents: number;
  buy_now_cents: number | null;
  size: string | null;
  /** Erbt der Server vom Termin — nie im Client setzen (siehe `20260819130000`). */
  women_only: boolean;
  sort_index: number;
};

/**
 * ⚠️ Die eine Spaltenliste, wie in `useListings.ts`. Wer hier ein Feld ergänzt,
 * ergänzt es im Typ darüber mit — die Doppelung ist am 16.08.2026 schon einmal
 * auseinandergelaufen (ein Bild wurde geholt und weggeworfen).
 */
const PREPARED_COLUMNS =
  'id, planned_for, seller_id, title, image_url, start_price_cents, ' +
  'min_increment_cents, buy_now_cents, size, women_only, sort_index';

/**
 * Was für diese Termine bereitliegt — nach Termin gruppiert.
 *
 * EINE Abfrage für alle sichtbaren Termine statt einer je Karte: Der Streifen
 * auf der Startseite zeigt bis zu zwölf, und zwölf Abfragen für eine Zeile Text
 * wären genau die Kostenhygiene-Sünde, vor der die Notizen warnen.
 *
 * Öffentlich lesbar, und das ist der Zweck: `live_auctions_select_standing`
 * erlaubt jede Zeile ohne Session, solange sie nicht Frauen-Only ist. Ein
 * Käufer soll ja gerade vorab sehen, was kommt. Die Frauen-Only-Schranke sitzt
 * am Artikel selbst — der Server vererbt sie beim Vorbereiten vom Termin.
 */
export function usePreparedByPlan(planIds: string[]) {
  // Stabiler Schlüssel: Ohne das Sortieren käme bei jeder Neuberechnung des
  // Aufrufers eine andere Reihenfolge und damit ein anderer Query-Key heraus —
  // dieselbe Falle wie bei `useCategoryListings`.
  const key = useMemo(() => [...planIds].sort().join(','), [planIds]);

  const query = useQuery({
    queryKey: ['berkat', 'prepared', key],
    enabled: planIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<PreparedAuction[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select(PREPARED_COLUMNS)
        .in('planned_for', key.split(','))
        // Beide Bedingungen sind nötig: `session_id is null` schließt aus, was
        // beim Live-Gehen schon übernommen wurde (dort bleibt `planned_for` als
        // Herkunft stehen), `status` schließt Dauerangebote aus.
        .is('session_id', null)
        .eq('status', 'scheduled')
        .order('sort_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PreparedAuction[];
    },
  });

  const byPlan = useMemo(() => {
    const map = new Map<string, PreparedAuction[]>();
    for (const row of query.data ?? []) {
      if (!row.planned_for) continue;
      const list = map.get(row.planned_for);
      if (list) list.push(row);
      else map.set(row.planned_for, [row]);
    }
    return map;
  }, [query.data]);

  return { ...query, byPlan };
}

export function prepareErrorText(message: string): string {
  if (message.includes('schedule_not_found'))
    return 'Diesen Termin gibt es nicht mehr. Lad die Seite neu.';
  if (message.includes('too_many_prepared'))
    return 'Fünfzig Artikel sind das Maximum für einen Abend — das reicht für jede Show. 🙂';
  if (message.includes('title_too_short')) return 'Der Name braucht mindestens zwei Zeichen.';
  if (message.includes('price_too_low')) return 'Der Startpreis muss mindestens 1 € sein.';
  if (message.includes('unknown_category'))
    return 'Diese Kategorie gibt es nicht mehr. Wähl eine andere.';
  if (message.includes('listing_not_found'))
    return 'Der Artikel ist nicht mehr da — vielleicht läuft die Show schon.';
  if (message.includes('forbidden')) return 'Das darf nur, wem der Termin gehört.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Vorbereiten-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz — was der Server sagt, steht hier. Begründung in
  // `useStanding.ts`: „Das hat nicht geklappt" ist keine Fehlermeldung.
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

export function usePrepareActions() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'prepared'] });
  }, [queryClient]);

  const prepare = useMutation({
    mutationFn: async (input: {
      planId: string;
      title: string;
      startCents: number;
      incrementCents?: number;
      imageUrl?: string | null;
      buyNowCents?: number | null;
      size?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('prepare_live_auction', {
        p_planned_for: input.planId,
        p_title: input.title.trim(),
        p_start_cents: input.startCents,
        p_increment_cents: input.incrementCents ?? 100,
        p_image_url: input.imageUrl ?? null,
        p_buy_now_cents: input.buyNowCents ?? null,
        // Kategorie und Zustand nimmt die RPC ebenfalls entgegen, das Formular
        // fragt sie aber nicht ab: Ein Show-Artikel wird vom Verkäufer vor der
        // Kamera erklärt, und `create_live_auction` kennt beide Felder gar
        // nicht — ein vorbereiteter Artikel wäre sonst reicher als derselbe
        // Artikel, spontan aufgelegt. Wer sie später will, ergänzt Formular und
        // diesen Aufruf gemeinsam.
        p_size: input.size ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
  });

  const discard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('discard_prepared_auction', { p_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { prepare, discard, invalidate };
}

/**
 * Beim Live-Gehen das Vorbereitete in die Show holen.
 *
 * ⚠️ **Immer mit Termin-ID.** Der Server erlaubt `p_planned_for = NULL` und
 * übernimmt dann ALLE eigenen vorbereiteten Artikel — der Client benutzt das
 * bewusst nie. Eine spontane Sendung würde damit auch das verschlucken, was für
 * kommenden Samstag vorbereitet ist, und weil die RPC **verschiebt statt zu
 * kopieren**, wäre die Vorbereitung des nächsten Abends danach weg. Wer keinen
 * passenden Termin hat, bekommt also nichts übernommen — das ist die richtige
 * Antwort, nicht die bequeme.
 *
 * Schlägt bewusst **nicht** laut fehl: dieselbe Lage wie bei `linkShowToPlan` —
 * die Show läuft an dieser Stelle schon, und ein misslungenes Übernehmen darf
 * den Gastgeber nicht aus seiner eigenen Sendung werfen.
 */
export async function claimPreparedAuctions(
  sessionId: string,
  planId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('claim_prepared_auctions', {
    p_session_id: sessionId,
    p_planned_for: planId,
  });
  if (error) {
    if (__DEV__) {
      console.warn('[Berkat] Vorbereitete Artikel nicht übernommen:', error.message);
    }
    return 0;
  }
  return (data as number | null) ?? 0;
}
