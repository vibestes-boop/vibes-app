// Dauerangebote — was ein Verkäufer auch ohne laufende Show verkauft.
//
// Fünf Verkäufer mit je zwei Stunden pro Woche senden zusammen 10 von 168
// Stunden. Die App ist rund 94 % der Zeit ein leerer Raum, und der Sendeplan
// beantwortet nur „wann passiert wieder was" — nicht „was kann ich JETZT tun".
//
// Ein Dauerangebot ist **keine eigene Tabelle**, sondern eine `live_auctions`-
// Zeile ohne Session mit Status `listed` (Migration 20260815210000). Dadurch
// erbt der Kauf ohne Zusatzarbeit: Sammelkorb, Versandpauschale, Stripe-Kasse,
// Webhook, Benachrichtigung und Verkäufer-Bestellliste.
//
// Gekauft wird über dieselbe RPC wie der Sofortkauf in der Show. Nebenbefund
// vom 15.08.2026: Diese RPC hatte bis dahin **gar keinen Aufrufer** — der
// Sofortkauf war serverseitig fertig und im Client nie verdrahtet.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type StandingListing = {
  id: string;
  title: string;
  image_url: string | null;
  /** Der Festpreis. Bei einem Dauerangebot immer gesetzt. */
  buy_now_cents: number;
  women_only: boolean;
  created_at: string;
  /**
   * Seit 20260816210000. Alle vier freiwillig — ein Pflichtformular baut genau
   * die Reibung wieder auf, die Berkat gegenüber einer WhatsApp-Gruppe
   * abschafft.
   *
   * ⚠️ Diese Felder stehen im Typ UND in der `.select()`-Kette unten. Genau
   * diese Doppelung ist am 16.08.2026 zweimal schiefgegangen — das Bild wurde
   * geholt und weggeworfen, weil der Zeilentyp es nicht trug.
   */
  description: string | null;
  condition: string | null;
  postal_code: string | null;
  city: string | null;
  /** Anbietertyp zum Zeitpunkt des Einstellens. NULL = noch nicht erklärt. */
  seller_kind: 'private' | 'business' | null;
};

/** Die Spalten eines Angebots — einmal, damit Typ und Abfrage nicht auseinanderlaufen. */
const LISTING_COLUMNS =
  'id, title, image_url, buy_now_cents, women_only, created_at, ' +
  'description, condition, postal_code, city, seller_kind';

/** Was dieser Verkäufer gerade dauerhaft anbietet. */
export function useStandingListings(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'standing', sellerId],
    enabled: Boolean(sellerId),
    staleTime: 30_000,
    queryFn: async (): Promise<StandingListing[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select(LISTING_COLUMNS)
        // `session_id is null` ist die Regal-Grenze. Ohne den Filter kämen
        // Show-Artikel mit, sobald sie denselben Status hätten.
        .is('session_id', null)
        .eq('seller_id', sellerId!)
        .eq('status', 'listed')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      // Doppelte Umleitung über `unknown`: supabase-js kann die lange
      // Spaltenliste nicht mehr auf einen Zeilentyp abbilden und fällt auf
      // `GenericStringError` zurück. Dasselbe Muster wie bei den Auktionen
      // (lib/useAuction.ts) — `StandingListing` oben ist die verbindliche Form.
      return (data ?? []) as unknown as StandingListing[];
    },
  });
}

export function standingErrorText(message: string): string {
  if (message.includes('price_too_low'))
    return 'Der Preis muss über 1 € liegen — darunter lohnt sich der Versand für niemanden.';
  if (message.includes('not_women_only_verified'))
    return 'Frauen-Only kannst du erst setzen, wenn dein Zugang freigegeben ist.';
  if (message.includes('seller_cannot_bid')) return 'Das ist dein eigener Artikel. 🙂';
  // Seit 20260816210000: Wer nicht für die Kasse freigeschaltet ist, verkauft
  // über Kontakt. Das ist kein Fehler des Käufers — der Text sagt deshalb, was
  // als Nächstes zu tun ist, statt was schiefging.
  if (message.includes('contact_seller'))
    return 'Diesen Artikel kaufst du direkt beim Verkäufer — schreib ihm kurz.';
  // Frauen-Only meldet sich bewusst als „gibt es nicht" (die Existenz soll
  // nicht über die Fehlermeldung durchsickern), fällt also in `auction_closed`.
  if (message.includes('unknown_category'))
    return 'Diese Kategorie gibt es nicht mehr. Wähl eine andere.';
  if (message.includes('auction_closed') || message.includes('listing_not_found'))
    return 'Der Artikel ist schon weg.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Dauerangebot-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz. „Das hat nicht geklappt" ist keine Fehlermeldung — es ist
  // eine Sackgasse, und sie hat am 15.08.2026 schon zweimal Zeit gekostet
  // (Trinkgeld-Kasse, Sammelkorb-Kasse). Was der Server sagt, steht hier.
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

export function useStandingActions(sellerId: string | undefined, myUserId: string | null) {
  const queryClient = useQueryClient();

  /**
   * Ein Dauerangebot steht an DREI Orten, und alle drei müssen nachladen.
   *
   * Am 16.08.2026 genau daran gescheitert: „Fahrrad" wurde unter Sonstiges
   * angelegt, auf dem Profil zurückgezogen — und blieb im Kategorien-Reiter
   * stehen. Antippen führte dann auf ein Profil, auf dem er nicht mehr war.
   * Die Datenbank war die ganze Zeit richtig (`status = 'cancelled'`), nur
   * wurde `['berkat', 'standing']` allein zurückgesetzt.
   *
   * Deshalb hier alles zusammen statt an jeder Aufrufstelle einzeln — beim
   * nächsten Regal-Ort ist es eine Zeile hier und nicht drei vergessene.
   */
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'standing'] });
    // Die Kachel-Zähler im Kategorien-Reiter …
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'categories'] });
    // … und die Liste auf der Kategorie-Seite selbst.
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'category-listings'] });
  }, [queryClient]);

  const create = useMutation({
    mutationFn: async (input: {
      title: string;
      priceCents: number;
      imageUrl?: string | null;
      womenOnly?: boolean;
      /** Slug aus `berkat_categories`. Ohne sie liegt der Artikel in keiner Kachel. */
      category?: string | null;
      /**
       * Alle vier freiwillig. Für ein Angebot ohne Sendung ist die Beschreibung
       * allerdings die einzige, die es je geben wird — in einer Show erzählt
       * der Verkäufer, hier steht nur, was er getippt hat.
       */
      description?: string | null;
      /** Slug aus `CONDITIONS` in `useBerkatSeller.ts`. */
      condition?: string | null;
      postalCode?: string | null;
      city?: string | null;
    }) => {
      // ⚠️ Neun Parameter seit Migration 20260816210000. Die RPC wurde dort per
      // DROP + CREATE ersetzt, NICHT überladen — zwei Überladungen machen
      // PostgREST mehrdeutig (HTTP 300). Ein älterer Client mit vier Parametern
      // bekommt deshalb PGRST202; das ist hier gefahrlos, weil Berkat in keinem
      // Store liegt und dieser Hook der einzige Aufrufer ist.
      const { data, error } = await supabase.rpc('create_standing_listing', {
        p_title: input.title.trim(),
        p_price_cents: input.priceCents,
        p_image_url: input.imageUrl ?? null,
        p_women_only: input.womenOnly ?? false,
        p_category: input.category ?? null,
        p_description: input.description ?? null,
        p_condition: input.condition ?? null,
        p_postal_code: input.postalCode ?? null,
        p_city: input.city ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_standing_listing', { p_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const buy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('buy_now_live_auction', { p_auction_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      // Der Artikel liegt jetzt im Sammelkorb — beide Ansichten davon müssen
      // nachladen, sonst steht unter „Konto" weiter der alte Stand.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-carts'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'cart'] });
    },
  });

  return { create, cancel, buy, canSell: Boolean(myUserId && myUserId === sellerId) };
}
