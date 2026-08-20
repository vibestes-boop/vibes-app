// Vorabgebot — ein Höchstgebot auf einen Artikel, dessen Show noch nicht läuft.
//
// ⚠️ KEIN NEUES FEATURE, SONDERN `set_max_bid` OHNE LAUFENDE SHOW.
// Berkat hat Stellvertreter-Bieten seit `20260813220000`: Man hinterlegt, wie
// weit man gehen würde, der Server bietet in Schritten mit — immer nur so viel
// wie nötig. Ein Vorabgebot ist genau das, nur früher gesetzt. Deshalb gibt es
// hier keine eigene Gebotslogik und keine zweite Tabelle; es ist dieselbe RPC
// auf einem Artikel im Zustand „vorbereitet" (Migration `20260819150000`).
//
// WAS BEIM START PASSIERT
// `start_live_auction` verrechnet die Vorabgebote in dem Moment, in dem die
// Auktion öffnet. Bei einem Vorabbieter startet sie beim Startpreis mit ihm als
// Führendem, bei zweien beim zweithöchsten Maximum plus Schritt — dieselbe
// geschlossene Rechnung wie im laufenden Betrieb.
//
// ⚠️ Die Maxima sind für niemanden lesbar außer dem Besitzer (`live_auto_bids`
// trägt `USING (auth.uid() = bidder_id)`). Wer fremde Maxima kennt, kann sie
// exakt überbieten — dann wäre das ganze Verfahren wertlos. Der Verkäufer
// bekommt deshalb nur die ANZAHL, über eine eigene RPC.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Das eigene hinterlegte Maximum — oder `null`, wenn keines vorliegt. */
export function useMyPrebid(auctionId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'prebid', auctionId, userId],
    enabled: Boolean(auctionId && userId),
    staleTime: 15_000,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('live_auto_bids')
        .select('max_cents')
        .eq('auction_id', auctionId!)
        .eq('bidder_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as { max_cents: number } | null)?.max_cents ?? null;
    },
  });
}

/**
 * Wie viele auf diese Artikel vorab geboten haben — nur für den VERKÄUFER.
 *
 * Der unterschätzte Teil des Ganzen: Die Zahl sagt ihm, welcher Artikel
 * Nachfrage hat, **bevor** er ihn aufruft — er kann die Reihenfolge des Abends
 * danach legen. Beträge gibt die RPC nicht heraus, und das ist keine
 * Zurückhaltung, sondern Voraussetzung: siehe Kopf.
 */
export function usePrebidCounts(auctionIds: string[]) {
  const key = [...auctionIds].sort().join(',');

  return useQuery({
    queryKey: ['berkat', 'prebid-counts', key],
    enabled: auctionIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('get_prebid_counts', {
        p_auction_ids: key.split(','),
      });
      if (error) {
        // Die Zahl ist eine Zugabe, kein Inhalt. Fehlt sie, fehlt eine Zeile —
        // ein leeres Blatt wäre die schlechtere Antwort.
        if (__DEV__) console.warn('[Berkat] Vorabgebote zählen:', error.message);
        return new Map();
      }
      const rows = (data ?? []) as { auction_id: string; bidders: number }[];
      return new Map(rows.map((r) => [r.auction_id, r.bidders]));
    },
  });
}

export function prebidErrorText(message: string): string {
  if (message.includes('bid_too_low'))
    return 'Das liegt unter dem Startpreis — nimm mehr.';
  if (message.includes('bid_too_high')) return 'So hoch geht es nicht. 🙂';
  if (message.includes('seller_cannot_bid')) return 'Das ist dein eigener Artikel. 🙂';
  if (message.includes('auction_not_running'))
    return 'Auf diesen Artikel kannst du gerade nicht vorab bieten.';
  if (message.includes('auction_ended')) return 'Die Auktion ist vorbei.';
  if (message.includes('prebid_locked'))
    return 'Die Auktion läuft schon — ein abgegebenes Gebot bleibt stehen.';
  if (message.includes('auction_not_found')) return 'Den Artikel gibt es nicht mehr.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Vorabgebot-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

export function usePrebidActions() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'prebid'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'prebid-counts'] });
    // „Du führst / Überboten" im Aktivitäts-Reiter liest `live_auto_bids` mit
    // (HANDOFF 39) — ohne das stünde ein frisch hinterlegtes Maximum dort erst
    // beim nächsten Öffnen.
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-bids'] });
  }, [queryClient]);

  const place = useMutation({
    mutationFn: async (input: { auctionId: string; maxCents: number }) => {
      const { data, error } = await supabase.rpc('set_max_bid', {
        p_auction_id: input.auctionId,
        p_max_cents: input.maxCents,
      });
      if (error) throw error;
      return data as { prebid?: boolean; my_max_cents?: number };
    },
    onSuccess: invalidate,
  });

  /**
   * Zurückziehen geht NUR vor dem Start — der Server prüft das noch einmal.
   *
   * Ein Gebot in einer laufenden Auktion ist bindend, deshalb kennt
   * `set_max_bid` auch nur den Weg nach oben. Vor der Eröffnung gibt es aber
   * keinen Wettbewerb, den ein Rückzug entwerten könnte, und zwischen
   * „übermorgen" und „jetzt" darf sich eine Meinung ändern.
   */
  const cancel = useMutation({
    mutationFn: async (auctionId: string) => {
      const { error } = await supabase.rpc('cancel_prebid', { p_auction_id: auctionId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { place, cancel };
}
