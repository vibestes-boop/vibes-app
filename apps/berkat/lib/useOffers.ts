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
