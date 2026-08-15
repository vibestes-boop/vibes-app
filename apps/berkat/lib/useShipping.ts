// Was der Versand kostet — für die Anzeige vor dem Bieten, vor dem Bezahlen und
// beim Packen.
//
// Der genaue Betrag entsteht erst in der Kasse, weil er von der Zone abhängt und
// Stripe die Adresse dort einsammelt. Vorher lässt sich ehrlich nur der
// **günstigste** Satz nennen: „zzgl. Versand ab 4,90 €".
//
// Das ist keine Marketing-Formulierung, sondern die einzige Aussage, die für
// jeden Käufer stimmt. Den DE-Satz als „den" Versandpreis zu zeigen wäre für
// jeden in Österreich falsch, und ein Preis, der sich beim Bezahlen verdoppelt,
// ist der schnellste Weg, Vertrauen zu verlieren.
//
// Gelesen wird direkt aus `berkat_shipping_rates` — die Tabelle ist bewusst für
// jeden lesbar, weil ein Versandpreis eine Preisangabe ist und keine Auskunft,
// die man zurückhalten darf.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

type Rate = { seller_id: string | null; country: string; cents: number };

async function fetchRates(): Promise<Rate[]> {
  const { data, error } = await supabase
    .from('berkat_shipping_rates')
    .select('seller_id, country, cents');
  if (error) throw error;
  return (data ?? []) as Rate[];
}

/**
 * Je Zone genau ein gültiger Satz: Der Eintrag des Verkäufers schlägt die
 * Vorgabe der Plattform.
 *
 * Dieselbe Regel wie serverseitig in `get_cart_shipping_options`. Wer sie hier
 * anders auslegt, zeigt einen Preis an, den die Kasse nicht nimmt — deshalb
 * steht sie an EINER Stelle und wird von allen drei Hooks benutzt.
 */
function resolveByCountry(rows: Rate[], sellerId: string | undefined): Map<string, number> {
  const perCountry = new Map<string, Rate>();
  for (const row of rows) {
    if (row.seller_id !== null && row.seller_id !== sellerId) continue;
    const seen = perCountry.get(row.country);
    if (!seen || (seen.seller_id === null && row.seller_id !== null)) {
      perCountry.set(row.country, row);
    }
  }
  return new Map([...perCountry].map(([country, rate]) => [country, rate.cents]));
}

function cheapest(byCountry: Map<string, number>): number | null {
  const min = [...byCountry.values()].reduce((acc, c) => (c < acc ? c : acc), Infinity);
  return Number.isFinite(min) ? min : null;
}

/**
 * Der günstigste Versandsatz dieses Verkäufers, in Cent.
 *
 * `null` heißt „keine Sätze hinterlegt" — dann wird auch nichts eingezogen und
 * es darf nichts angezeigt werden. Kein Rückfall auf einen erfundenen Wert.
 */
export function useShippingFrom(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'shipping-from', sellerId],
    enabled: Boolean(sellerId),
    // Versandsätze ändern sich selten — einmal je Sitzung reicht.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<number | null> =>
      cheapest(resolveByCountry(await fetchRates(), sellerId)),
  });
}

/** „ab 4,90 €" — oder nichts, wenn keine Sätze hinterlegt sind. */
export function shippingHint(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  if (cents === 0) return 'Versand inklusive';
  return `zzgl. Versand ab ${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Dasselbe für eine LISTE von Verkäufern — im Konto stehen mehrere Pakete
 * nebeneinander, und ein Hook je Karte geht in einer Schleife nicht.
 *
 * Die Tabelle ist winzig (drei Plattform-Zeilen plus je Verkäufer eine pro
 * Zone), deshalb wird sie einmal komplett geholt statt je Paket einzeln.
 */
export function useShippingLookup() {
  const query = useQuery({
    queryKey: ['berkat', 'shipping-all'],
    staleTime: 10 * 60_000,
    queryFn: fetchRates,
  });
  const rows = query.data ?? [];
  return (sellerId: string | undefined): number | null =>
    rows.length === 0 ? null : cheapest(resolveByCountry(rows, sellerId));
}

/**
 * Für den Verkäufer beim Packen: Passt der bezahlte Versand zum Lieferland?
 *
 * ⚠️ **Stripe Checkout kann Versandoptionen NICHT ans Lieferland binden.** Der
 * Käufer wählt frei aus allen Zonen, und Stripe sammelt die Adresse getrennt
 * ein. Am 15.08.2026 sofort im ersten echten Durchlauf aufgetreten: zwei
 * Bestellungen mit `shipping_cents = 990` und `ship_country = 'DE'`.
 *
 * Der häufigere Fall ist **kein Betrug, sondern ein Versehen** — jemand in
 * Österreich tippt auf die erste angebotene Option. Deshalb wird hier nichts
 * blockiert, sondern nur sichtbar gemacht: Der Verkäufer sieht es VOR dem
 * Packen und kann fragen, statt es erst am Schalter zu merken.
 *
 * Wirklich erzwingen ließe es sich nur mit einer eigenen Bezahlmaske statt
 * Stripe Checkout — das gehört zu Stripe Connect und damit in Phase 2.
 */
export function useShippingCheck(sellerId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['berkat', 'shipping-all'],
    staleTime: 10 * 60_000,
    queryFn: fetchRates,
  });
  const byCountry = resolveByCountry(query.data ?? [], sellerId ?? undefined);

  /** Fehlbetrag in Cent, oder `null` wenn alles passt bzw. nichts prüfbar ist. */
  return (paidCents: number | null | undefined, country: string | null): number | null => {
    if (paidCents == null || !country) return null;
    const expected = byCountry.get(country.toUpperCase());
    if (expected == null) return null;
    return paidCents < expected ? expected - paidCents : null;
  };
}

/** „1,00 €" */
export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
