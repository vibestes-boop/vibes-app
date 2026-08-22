// Dauerangebote — die Aktionen. Der Zeilentyp und die Abfragen liegen in
// `useListings.ts`.
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
//
// ⚠️ Seit dem 17.08.2026 ruft `buy` nur noch die Artikelseite auf. Aus den
// Rastern ist der Kaufknopf verschwunden — siehe Kopf von `ListingCard.tsx`.

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

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
  if (message.includes('too_many_images'))
    return 'Mehr als 8 Fotos gehen nicht — nimm die aussagekräftigsten.';
  if (message.includes('title_too_short'))
    return 'Der Titel braucht mindestens 2 Zeichen.';
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
   * Ein Dauerangebot steht an VIER Orten, und alle vier müssen nachladen.
   *
   * Am 16.08.2026 genau daran gescheitert: „Fahrrad" wurde unter Sonstiges
   * angelegt, auf dem Profil zurückgezogen — und blieb im Kategorien-Reiter
   * stehen. Antippen führte dann auf ein Profil, auf dem er nicht mehr war.
   * Die Datenbank war die ganze Zeit richtig (`status = 'cancelled'`), nur
   * wurde `['berkat', 'standing']` allein zurückgesetzt.
   *
   * Deshalb hier alles zusammen statt an jeder Aufrufstelle einzeln — beim
   * nächsten Regal-Ort ist es eine Zeile hier und nicht vier vergessene.
   */
  const invalidate = useCallback(() => {
    // Das Regal eines Verkäufers (Profil, `/shelf`) …
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'standing'] });
    // … die Kachel-Zähler im Kategorien-Reiter …
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'categories'] });
    // … die Liste auf der Kategorie-Seite …
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'category-listings'] });
    // … der Marktplatz und sein Zähler im Leerzustand der Startseite …
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'shop'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'shop-count'] });
    // … und seit dem 17.08.2026 die Artikelseite selbst. Ohne sie stünde nach
    // einem Kauf weiter „Kaufen · 24 €" auf genau dem Bildschirm, von dem aus
    // gekauft wurde.
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'listing'] });
  }, [queryClient]);

  const create = useMutation({
    mutationFn: async (input: {
      title: string;
      priceCents: number;
      /** Alle Bilder in Reihenfolge, das erste ist das Cover. Max. 8 (Server-CHECK). */
      imageUrls?: string[];
      womenOnly?: boolean;
      /** Nimmt Preisvorschläge an. Der Composer setzt ihn für Neues sichtbar auf an. */
      acceptsOffers?: boolean;
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
      /** Freitext, max. 24 Zeichen (Server-CHECK). Siehe `Listing.size`. */
      size?: string | null;
      postalCode?: string | null;
      city?: string | null;
    }) => {
      // ⚠️ Elf Parameter seit Migration 20260819100000 (vorher zehn, davor
      // vier). Die RPC wurde jedes Mal per DROP + CREATE ersetzt, NICHT
      // überladen — zwei Überladungen machen PostgREST mehrdeutig (HTTP 300).
      // Ein älterer Client mit weniger Parametern bekommt deshalb PGRST202.
      //
      // ⚠️ RICHTIGSTELLUNG 21.08.2026: Hier stand „das ist gefahrlos, weil
      // Berkat in keinem Store liegt". Das gilt NICHT MEHR — `1.0.0 (1)` liegt
      // seit dem 21.08. in TestFlight, und ein OTA erreicht nur die Laufzeit
      // 1.0.0. Wer diese RPC jetzt noch einmal per DROP + CREATE ersetzt, macht
      // jede ausgelieferte Fassung ohne passenden OTA blind — das Anlegen
      // scheitert dann mit PGRST202 statt mit einer Fehlermeldung, die jemand
      // versteht.
      //
      // Deshalb bekommt der Termin („Reserve for Live", Analyse 10) auch KEINEN
      // zwölften Parameter, sondern einen zweiten Ruf: `move_listing_to_show`
      // nach dem Anlegen (`app/shelf.tsx`). Eine neue Funktion daneben ist
      // billiger als eine geänderte Signatur unter einer laufenden App.
      const { data, error } = await supabase.rpc('create_standing_listing', {
        p_title: input.title.trim(),
        p_price_cents: input.priceCents,
        p_image_urls: input.imageUrls ?? [],
        p_women_only: input.womenOnly ?? false,
        p_accepts_offers: input.acceptsOffers ?? false,
        p_category: input.category ?? null,
        p_description: input.description ?? null,
        p_condition: input.condition ?? null,
        p_postal_code: input.postalCode ?? null,
        p_city: input.city ?? null,
        p_size: input.size ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
  });

  /**
   * Bearbeiten — Vollersatz, kein Teil-Update.
   *
   * Das Formular ist vorbefüllt und schickt immer alle Felder; was ankommt,
   * gilt. Nur so lässt sich eine Beschreibung auch wieder LEEREN — ein
   * „NULL heißt behalten" könnte das nicht. `seller_kind` fasst die RPC
   * bewusst nicht an, den pflegt allein `set_berkat_seller_kind`.
   *
   * ⚠️ Daraus folgt eine Pflicht für JEDE neue Spalte: Sie muss in `initial`
   * des Formulars stehen. Ein Bearbeiten-Blatt, das `size` nicht KENNT, schickt
   * hier `null` — und löscht die Größe beim ersten Speichern, ohne dass jemand
   * sie angefasst hätte. Derselbe Grund, aus dem `category` im Zeilentyp steht.
   */
  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      priceCents: number;
      imageUrls?: string[];
      womenOnly?: boolean;
      acceptsOffers?: boolean;
      category?: string | null;
      description?: string | null;
      condition?: string | null;
      size?: string | null;
      postalCode?: string | null;
      city?: string | null;
    }) => {
      const { error } = await supabase.rpc('update_standing_listing', {
        p_id: input.id,
        p_title: input.title.trim(),
        p_price_cents: input.priceCents,
        p_image_urls: input.imageUrls ?? [],
        p_women_only: input.womenOnly ?? false,
        p_accepts_offers: input.acceptsOffers ?? false,
        p_category: input.category ?? null,
        p_description: input.description ?? null,
        p_condition: input.condition ?? null,
        p_postal_code: input.postalCode ?? null,
        p_city: input.city ?? null,
        p_size: input.size ?? null,
      });
      if (error) throw error;
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
    /**
     * `offerId` löst eine angenommene Zusage ein — der Server rechnet dann mit
     * dem vereinbarten statt dem Listenpreis. Ohne ihn der alte Weg,
     * unverändert.
     */
    mutationFn: async (input: string | { id: string; offerId?: string }) => {
      const id = typeof input === 'string' ? input : input.id;
      const offerId = typeof input === 'string' ? null : (input.offerId ?? null);
      const { error } = await supabase.rpc('buy_now_live_auction', {
        p_auction_id: id,
        p_offer_id: offerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      // Der Artikel liegt jetzt im Sammelkorb — beide Ansichten davon müssen
      // nachladen, sonst steht unter „Konto" weiter der alte Stand.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-carts'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'cart'] });
      // Der Kauf erklärt alle offenen Vorschläge auf diesen Artikel für
      // erledigt (serverseitig) — die Listen müssen das mitbekommen.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'offers'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'offer-count'] });
    },
  });

  return { create, update, cancel, buy, canSell: Boolean(myUserId && myUserId === sellerId) };
}
