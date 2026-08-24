// Preisvorschläge — handeln, aber mit Zustand.
//
// Der „Nachricht"-Knopf am Privatangebot war schon ein Preisvorschlag, nur
// unstrukturiert: eine Zahl im Fließtext, die keine Seite verbindlich sah. Hier
// bekommt sie einen Zustand, den beide lesen — offen, angenommen, gekontert,
// abgelehnt.
//
// Vorbild ist Whatnots „Accept offers" (Schalter je Angebot, annehmen/kontern/
// ablehnen). Der Unterschied: Dort ist Handeln die Ausnahme, hier die Norm —
// Kleinanzeigen-Kultur.
//
// ⚠️ KEIN neuer `notifications`-Typ. Ein Typ dort bräuchte neun Oberflächen auf
// einmal, und wer nur einen Teil anfasst, bekommt „Neue Aktivität auf Serlo"
// (Übergabe Abschnitt 9/18). Ein Vorschlag ist nicht eilig genug dafür — er
// steht auf der Artikelseite und im Aktivitäts-Reiter.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'countered'
  | 'withdrawn';

export type Offer = {
  id: string;
  auction_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  /** Gegenvorschlag des Verkäufers. Nur bei `status = 'countered'`. */
  counter_cents: number | null;
  status: OfferStatus;
  created_at: string;
  responded_at: string | null;
};

const OFFER_COLUMNS =
  'id, auction_id, buyer_id, seller_id, amount_cents, counter_cents, status, ' +
  'created_at, responded_at';

/** Ein offener Vorschlag ist einer, auf den noch jemand antworten kann. */
export function isOpen(offer: Offer): boolean {
  return offer.status === 'pending' || offer.status === 'countered';
}

/**
 * Alle Vorschläge zu EINEM Angebot.
 *
 * Die RLS gibt jedem nur seine eigenen heraus — der Käufer sieht damit genau
 * einen (seinen), der Verkäufer alle. Dieselbe Abfrage, zwei Sichten, keine
 * Fallunterscheidung im Client. Was jemand zu zahlen bereit war, geht Dritte
 * nichts an.
 */
export function useOffersForListing(auctionId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'offers', auctionId],
    enabled: Boolean(auctionId && userId),
    staleTime: 15_000,
    queryFn: async (): Promise<Offer[]> => {
      const { data, error } = await supabase
        .from('berkat_offers')
        .select(OFFER_COLUMNS)
        .eq('auction_id', auctionId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Offer[];
    },
  });
}

/**
 * Wie viele Vorschläge auf eine Antwort warten — die Zahl für das Abzeichen.
 *
 * `head: true` überträgt keine einzige Zeile; dasselbe Muster wie beim
 * Bestell-Abzeichen. Fehler werden geschluckt: Ein fehlendes Abzeichen ist
 * ärgerlich, ein kaputter Reiter wäre schlimmer.
 */
export function useOpenOfferCount(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'offer-count', userId],
    enabled: Boolean(userId),
    staleTime: 20_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('berkat_offers')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId!)
        .eq('status', 'pending');
      if (error) {
        if (__DEV__) console.warn('[Berkat] Offene Vorschläge zählen:', error.message);
        return 0;
      }
      return count ?? 0;
    },
  });
}

/** Ein offener Vorschlag samt dem Artikel, um den es geht. */
export type SellerOffer = Offer & {
  title: string;
  image_url: string | null;
  /** Der Listenpreis — ohne ihn sagt „35 €" nichts über den Nachlass. */
  buy_now_cents: number | null;
};

/**
 * Alle Vorschläge, die auf MEINE Antwort warten — über alle Artikel hinweg.
 *
 * ⚠️ DIESE ABFRAGE SCHLIESST EIN LOCH VOM 18.08.2026. `useOpenOfferCount` trägt
 * seit dem ersten Tag den Kommentar „die Zahl für das Abzeichen" — das Abzeichen
 * wurde nie gebaut, und ein neuer `notifications`-Typ war bewusst abgelehnt
 * (HANDOFF 24). Ergebnis: Ein Käufer schickte einen Preisvorschlag, und der
 * Verkäufer erfuhr es nur, wenn er zufällig genau diesen Artikel öffnete.
 *
 * `countered` zählt mit, obwohl dort der KÄUFER am Zug ist: Der Verkäufer soll
 * die laufende Verhandlung sehen, nicht nur die unbeantwortete. Das Abzeichen
 * (`useOpenOfferCount`) zählt weiterhin nur `pending` — es soll auf null gehen
 * können, sonst liest es bald niemand mehr (die Lehre vom Bestell-Abzeichen).
 *
 * Zwei Abfragen statt eines Embeds: `berkat_offers → live_auctions` wäre zwar
 * ein echter Fremdschlüssel, aber PostgREST-Embeds sind in diesem Projekt schon
 * einmal still zu einer leeren Liste geworden. Zwei Abfragen können das nicht.
 */
/**
 * Meine eigenen offenen Vorschläge — die Käufer-Sicht.
 *
 * ── ⚠️ WARUM ES DAS BRAUCHT (24.08.2026) ────────────────────────────────────
 *
 * Eine Unwucht, die beim Vergleich mit Whatnots Aktivitäts-Reiter auffiel:
 * Offene GEBOTE haben auf „Aktivität" einen festen Platz (`useMyBids`, Block
 * „Wo ich mitbiete"). Offene VORSCHLÄGE hatten keinen — obwohl beides dasselbe
 * ist: „ich habe da etwas laufen und warte auf Antwort."
 *
 * Wer einen Vorschlag machte und die App schloss, hatte keinen Weg zurück
 * ausser einer Push-Meldung. Er hätte sich merken müssen, bei WELCHEM Artikel
 * er verhandelt hat.
 *
 * ⚠️ Das ist ausdrücklich KEIN Widerspruch zur Entscheidung in
 * `components/OfferPanel.tsx` („Bewusst KEIN eigener Bildschirm. Ein Vorschlag
 * gehört an den Artikel, über den verhandelt wird"). Die gilt für das
 * VERHANDELN. Diese Liste verhandelt nichts — sie ist ein Wegweiser zurück zum
 * Artikel, genau wie die Gebots-Liste zum Live-Raum weist.
 *
 * Zwei Abfragen statt eines Embeds, aus demselben Grund wie bei
 * `useSellerOffers`: PostgREST-Embeds sind in diesem Projekt schon einmal still
 * zu einer leeren Liste geworden.
 */
export function useMyOpenOffers(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-offers', userId],
    enabled: Boolean(userId),
    staleTime: 20_000,
    queryFn: async (): Promise<SellerOffer[]> => {
      const { data, error } = await supabase
        .from('berkat_offers')
        .select(OFFER_COLUMNS)
        // Der einzige Unterschied zu `useSellerOffers`: die andere Seite des
        // Tisches. `countered` gehört dazu — ein Gegenvorschlag ist der Fall,
        // in dem der Käufer am dringendsten zurückmuss.
        .eq('buyer_id', userId!)
        .in('status', ['pending', 'countered'])
        .order('created_at', { ascending: false });
      if (error) throw error;

      const offers = (data ?? []) as unknown as Offer[];
      if (offers.length === 0) return [];

      const ids = [...new Set(offers.map((o) => o.auction_id))];
      const { data: rows, error: e2 } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, buy_now_cents')
        .in('id', ids);
      if (e2) throw e2;

      const byId = new Map(
        ((rows ?? []) as { id: string; title: string; image_url: string | null; buy_now_cents: number | null }[])
          .map((r) => [r.id, r]),
      );

      return offers.map((o) => {
        const a = byId.get(o.auction_id);
        return {
          ...o,
          title: a?.title ?? 'Artikel nicht mehr da',
          image_url: a?.image_url ?? null,
          buy_now_cents: a?.buy_now_cents ?? null,
        };
      });
    },
  });
}

export function useSellerOffers(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'seller-offers', userId],
    enabled: Boolean(userId),
    staleTime: 20_000,
    queryFn: async (): Promise<SellerOffer[]> => {
      const { data, error } = await supabase
        .from('berkat_offers')
        .select(OFFER_COLUMNS)
        .eq('seller_id', userId!)
        .in('status', ['pending', 'countered'])
        .order('created_at', { ascending: false });
      if (error) throw error;

      const offers = (data ?? []) as unknown as Offer[];
      if (offers.length === 0) return [];

      const ids = [...new Set(offers.map((o) => o.auction_id))];
      const { data: rows, error: e2 } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, buy_now_cents')
        .in('id', ids);
      if (e2) throw e2;

      const byId = new Map(
        ((rows ?? []) as { id: string; title: string; image_url: string | null; buy_now_cents: number | null }[])
          .map((r) => [r.id, r]),
      );

      return offers.map((o) => {
        const a = byId.get(o.auction_id);
        return {
          ...o,
          // Fällt der Artikel weg (gelöscht, unsichtbar geworden), bleibt der
          // Vorschlag trotzdem in der Liste — mit ehrlichem Platzhalter statt
          // stillem Verschwinden.
          title: a?.title ?? 'Artikel nicht mehr da',
          image_url: a?.image_url ?? null,
          buy_now_cents: a?.buy_now_cents ?? null,
        };
      });
    },
  });
}

export function offerErrorText(message: string): string {
  if (message.includes('offer_above_price'))
    return 'Dein Vorschlag liegt über dem Preis — dann kauf ihn lieber direkt. 🙂';
  if (message.includes('offer_already_open'))
    return 'Du hast schon einen Vorschlag laufen. Warte auf die Antwort oder zieh ihn zurück.';
  if (message.includes('offers_not_accepted'))
    return 'Dieser Verkäufer handelt nicht — hier gilt der Festpreis.';
  if (message.includes('counter_too_low'))
    return 'Ein Gegenvorschlag muss über dem Vorschlag liegen.';
  if (message.includes('counter_above_price'))
    return 'Auf den vollen Preis zu kontern heißt „nein" — dann sag lieber ab.';
  if (message.includes('offer_not_valid'))
    return 'Diese Zusage gilt nicht mehr.';
  // ⚠️ Der Satz sagt, was gilt UND was geht — nicht nur „nein" (Design-Gesetz 2).
  // Die Zusage ist nicht weg: Sie gilt wieder, sobald der Artikel nicht mehr
  // versteigert wird. Nur während der laufenden Auktion zählt allein das Gebot
  // (`20260822230000`).
  if (message.includes('offer_auction_running'))
    return 'Der Artikel wird gerade versteigert — solange die Uhr läuft, zählt nur das Gebot. Deine Zusage gilt danach wieder.';
  if (message.includes('offer_closed') || message.includes('offer_not_found'))
    return 'Dieser Vorschlag ist schon erledigt.';
  if (message.includes('price_too_low'))
    return 'Über 1 € — darunter lohnt sich der Versand für niemanden.';
  if (message.includes('seller_cannot_bid')) return 'Das ist dein eigener Artikel. 🙂';
  if (message.includes('auction_closed') || message.includes('listing_not_found'))
    return 'Der Artikel ist schon weg.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Vorschlag-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz — was der Server sagt, steht hier (Übergabe Abschnitt 3).
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

export function useOfferActions(auctionId: string | undefined, userId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'offers', auctionId] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'offer-count'] });
    // Der dritte Ort seit dem 19.08.2026: die Liste aller offenen Vorschläge
    // im Verkaufen-Bereich. Ohne das bliebe ein eben beantworteter Vorschlag
    // dort stehen.
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'seller-offers'] });
    // Ein angenommener Vorschlag ändert den Kaufknopf auf der Artikelseite.
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'listing', auctionId] });
  };

  const make = useMutation({
    mutationFn: async (amountCents: number) => {
      const { data, error } = await supabase.rpc('make_berkat_offer', {
        p_auction_id: auctionId,
        p_amount_cents: amountCents,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
  });

  const respond = useMutation({
    mutationFn: async (input: {
      offerId: string;
      action: 'accept' | 'decline' | 'counter';
      counterCents?: number;
    }) => {
      const { error } = await supabase.rpc('respond_berkat_offer', {
        p_offer_id: input.offerId,
        p_action: input.action,
        p_counter_cents: input.counterCents ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const withdraw = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.rpc('withdraw_berkat_offer', { p_offer_id: offerId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { make, respond, withdraw, signedIn: Boolean(userId) };
}
