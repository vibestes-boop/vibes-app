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

type Rate = { seller_id: string | null; country: string; cents: number; tier: number };

async function fetchRates(): Promise<Rate[]> {
  const { data, error } = await supabase
    .from('berkat_shipping_rates')
    .select('seller_id, country, cents, tier');
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
function resolveByCountry(
  rows: Rate[],
  sellerId: string | undefined,
  tier: number,
): Map<string, number> {
  const perCountry = new Map<string, Rate>();
  for (const row of rows) {
    if (row.seller_id !== null && row.seller_id !== sellerId) continue;
    const seen = perCountry.get(row.country);
    if (!seen || better(row, seen, tier)) perCountry.set(row.country, row);
  }
  return new Map([...perCountry].map(([country, rate]) => [country, rate.cents]));
}

/**
 * ⚠️ ZEICHENGENAU DIE SORTIERREGEL AUS `get_cart_shipping_options`
 * (`20260823140000`). Wer sie hier anders auslegt, zeigt einen Preis an, den
 * die Kasse nicht nimmt — und genau dieser Bruch ist der teuerste, den diese
 * Datei haben kann.
 *
 *   1. der eigene Satz des Verkäufers schlägt die Vorgabe der Plattform
 *   2. Stufen, die AUSREICHEN, vor solchen, die es nicht tun
 *   3. darunter die kleinste ausreichende — und wenn keine ausreicht, die
 *      grösste vorhandene
 */
function better(cand: Rate, seen: Rate, tier: number): boolean {
  const own = (r: Rate) => (r.seller_id !== null ? 0 : 1);
  if (own(cand) !== own(seen)) return own(cand) < own(seen);

  const fits = (r: Rate) => (r.tier >= tier ? 0 : 1);
  if (fits(cand) !== fits(seen)) return fits(cand) < fits(seen);

  return cand.tier >= tier ? cand.tier < seen.tier : cand.tier > seen.tier;
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
export function useShippingFrom(sellerId: string | undefined, tier?: number | null) {
  // ⚠️ NULL heisst „nicht angegeben" und wird serverseitig als 4 gerechnet.
  // Hier genauso — sonst verspricht die Karte 1,19 €, und die Kasse verlangt
  // 4,90 €. Der Default MUSS die teuerste Stufe sein.
  const t = tier ?? 4;
  return useQuery({
    queryKey: ['berkat', 'shipping-from', sellerId, t],
    enabled: Boolean(sellerId),
    // Versandsätze ändern sich selten — einmal je Sitzung reicht.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<number | null> =>
      cheapest(resolveByCountry(await fetchRates(), sellerId, t)),
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
  // `tier` ist hier bewusst ein Parameter mit teurem Default: Im Konto stehen
  // ganze PAKETE nebeneinander, und deren Stufe ist die höchste ihrer Artikel.
  // Wer sie nicht kennt, muss den teuersten Satz zeigen.
  return (sellerId: string | undefined, tier?: number | null): number | null =>
    rows.length === 0 ? null : cheapest(resolveByCountry(rows, sellerId, tier ?? 4));
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
  const rows = query.data ?? [];

  /**
   * Fehlbetrag in Cent, oder `null` wenn alles passt bzw. nichts prüfbar ist.
   *
   * ⚠️ `tier` ist PFLICHT-relevant, auch wenn es optional aussieht: Seit
   * `20260823140000` hängt der erwartete Satz an der Versandstufe des Pakets.
   * Ohne sie würde jeder Brief-Versand als Unterdeckung gemeldet — ein
   * Fehlalarm, den der Verkäufer nach dem zweiten Mal nicht mehr liest.
   */
  return (
    paidCents: number | null | undefined,
    country: string | null,
    tier?: number | null,
  ): number | null => {
    if (paidCents == null || !country) return null;
    const byCountry = resolveByCountry(rows, sellerId ?? undefined, tier ?? 4);
    const expected = byCountry.get(country.toUpperCase());
    if (expected == null) return null;
    return paidCents < expected ? expected - paidCents : null;
  };
}

/** „1,00 €" */
export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
